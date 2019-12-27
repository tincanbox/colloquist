const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const glob = require("glob");

const winston = require('winston');
const winston_transport = require('winston-transport');
require('winston-daily-rotate-file');
require('winston-mongodb');

module.exports = class Logger {

  constructor(core, conf){

    this.core = core;
    this.engine = {};
    this.config = conf;

    this.levels = {
      emerg:     0,
      alert:     10,
      crit:      20,
      error:     30,
      warning:   40,
      notice:    50,
      info:      60,
      debug:     70,
      trace:     99,
      //
      dictation: 1,
    };

    this.colors = {
      emerg: "magenta",
      alert: "yellow",
      crit: "red",
      error: "red",
      warning: "yellow",
      notice: "cyan",
      info: "white",
      debug: "gray",
      trace: "white",
      //
      dictation: "grey"
    };

    this.color_list = {
      black   : '\u001b[30m',
      red     : '\u001b[31m',
      green   : '\u001b[32m',
      yellow  : '\u001b[33m',
      blue    : '\u001b[34m',
      magenta : '\u001b[35m',
      cyan    : '\u001b[36m',
      white   : '\u001b[37m',
      grey    : '\x1b[2m\u001b[37m',
      reset   : '\u001b[0m'
    }

    winston.addColors(this.colors);

    //
    if(this.config.level == "all"){
      this.config.level = "trace";
    }

    this.format_app = (type) => {
      return winston.format.printf((info) => {
        let d = new Date;
        let dst =
          d.getFullYear()
          + "-"
          + ("0"+(d.getMonth()+1)).slice(-2)
          + "-"
          + ("0" + d.getDate()).slice(-2)
          + " "
          + ("0" + d.getHours()).slice(-2)
          + ":"
          + ("0" + d.getMinutes()).slice(-2)
          + ":"
          + ("0" + d.getSeconds()).slice(-2)
        ;

        return (dst + "|" + info.level.toUpperCase() + "| "
          + (
            info.prev
            ? info.prev + " | "
            : (info.trace ? info.trace[0].file + ":" + info.trace[0].line + " | " : "")
          ) +
          (() => {
            let s = info.message;
            switch(typeof s){
              case "string":
              case "number":
                switch(type){
                  case "console":
                    s = this.colorify(s);
                    break;
                  default:
                    s = this.decolorify(s);
                    break;
                }
                return s.split("\n").join(", ");
              default:
                return JSON.stringify(s);
            }
          })()
        );
      })
    }

    this.format_plain = (type) => {
      return winston.format.printf(info => {
        return (type == "console")
          ? this.colorify(info.message)
          : this.decolorify(info.message);
      });
    }

    var now = new Date();
    this.active_time = now.getFullYear() + ""
      + ('0' + (now.getMonth() + 1)).slice(-2)
      + ('0' + now.getDate()).slice(-2)
      + ('0' + now.getHours()).slice(-2)
      + ('0' + now.getMinutes()).slice(-2)
      + ('0' + now.getSeconds()).slice(-2);
  }

  async init(){

    this.engine.def = winston.createLogger({
      level: this.config.level,
      levels: this.levels,
      format: winston.format.combine(
        this.format_app()
      ),
      transports: await this.generate_transport('def')
    });

    this.engine.plain = winston.createLogger({
      level: this.config.level,
      levels: this.levels,
      format: winston.format.combine(
        this.format_plain()
      ),
      transports: await this.generate_transport('plain')
    });

    this.engine.trace = winston.createLogger({
      level: this.config.level,
      levels: this.levels,
      format: winston.format.combine(
        winston.format.printf(info => {
          return info.message;
        })
      ),
      transports: await this.generate_transport('trace')
    });

    await this.rotate('dictation.log', this.config.rotation.count.dictation, false);

    this.active_dictation_log = this.config.path + 'dictation.log.' + (this.active_time);

    this.engine.dictation = winston.createLogger({
      level: 0,
      levels: this.levels,
      format: winston.format.combine(
        this.format_plain()
      ),
      transports: await this.generate_transport('dictation')
    });

    /* Attaches `finish` event and keep it pending,
     * until Logger.close() is called.
     */
    this.finish_state_observer = new Promise((res) => {
      for(var k in this.engine)
        for(var transport of this.engine[k].transports)
          transport.on('finish', res);
    });

  }

  async generate_transport(name){
    var transport = [];
    var dbs = this.config.output.filter(r => r.match(/^database/)).map((a) => a.replace(/^database:/, ""));

    switch(name){
      case "def":
        if(this.config.output.includes('console'))
          transport.push(
            new winston.transports.Console({
              format: winston.format.combine(
                this.format_app("console")
              )
            })
          );

        if(this.config.output.includes('file'))
          transport.push(
            new (winston.transports.DailyRotateFile)({
              level: 'emerg',
              filename: this.config.path + 'error.log',
              datePattern: 'YYYY-MM-DD-HH',
              maxSize: this.config.rotation.size,
              maxFiles: this.config.rotation.term
            }),
            new (winston.transports.DailyRotateFile)({
              level: 'warning',
              filename: this.config.path + 'warning.log',
              datePattern: 'YYYY-MM-DD',
              maxSize: this.config.rotation.size,
              maxFiles: this.config.rotation.term
            }),
            new (winston.transports.DailyRotateFile)({
              level: 'trace',
              filename: this.config.path + 'app.log',
              datePattern: 'YYYY-MM-DD',
              maxSize: this.config.rotation.size,
              maxFiles: this.config.rotation.term
            })
          );

        if(dbs.length)
          dbs.forEach(db => {
            transport.push(
              new LoggerTransport_Database(this, {
                database: db,
                level: 'trace'
              })
            )
          });

        break;

      case "plain":
        if(this.config.output.includes('console'))
          transport.push(
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.colorize(),
                this.format_plain("console")
              )
            })
          );

        if(this.config.output.includes('file'))
          transport.push(
            new (winston.transports.DailyRotateFile)({
              level: 'emerg',
              filename: this.config.path + 'error.log',
              datePattern: 'YYYY-MM-DD-HH',
              maxSize: this.config.rotation.size,
              maxFiles: this.config.rotation.term
            }),
            new (winston.transports.DailyRotateFile)({
              level: 'warning',
              filename: this.config.path + 'warning.log',
              datePattern: 'YYYY-MM-DD',
              maxSize: this.config.rotation.size,
              maxFiles: this.config.rotation.term
            }),
            new (winston.transports.DailyRotateFile)({
              level: 'trace',
              filename: this.config.path + 'app.log',
              datePattern: 'YYYY-MM-DD',
              maxSize: this.config.rotation.size,
              maxFiles: this.config.rotation.term
            })
          );

        if(dbs.length)
          dbs.forEach(db => {
            transport.push(
              new LoggerTransport_Database(this, {
                database: db,
                level: 'trace'
              })
            )
          });

        break;

      case "trace":
        if(this.config.output.includes('console'))
          transport.push(
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.colorize(),
                this.format_plain("console")
              )
            })
          );

        if(this.config.output.includes("file"))
          transport.push(
            new (winston.transports.DailyRotateFile)({
              level: 'trace',
              filename: this.config.path + 'trace.log',
              datePattern: 'YYYY-MM-DD',
              maxSize: this.config.rotation.size,
              maxFiles: this.config.rotation.term
            })
          );

        if(dbs.length)
          dbs.forEach(db => {
            transport.push(
              new LoggerTransport_Database(this, {
                database: db,
                level: 'trace'
              })
            )
          });

        break;

      case "dictation":
        if(this.config.output.includes('console'))
          transport.push(
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.printf(info => {
                  return this.colorify("<green>" + info.message + "</green>");
                }),
              )
            })
          );

        if(this.config.output.includes('file'))
          transport.push(
            //new LoggerTransport_FileRotation_RuntimeBased({
            //  level: 'dictation',
            //  runtime: this.active_time,
            //  filename: 'dictation.log'
            //}),
            new (winston.transports.File)({
              filename: this.active_dictation_log
            })
          );

        if(dbs.length)
          dbs.forEach(db => {
            transport.push(
              new LoggerTransport_Database(this, {
                level: 'dictation',
                database: db
              })
            )
          });

        break;
    }

    return transport;
  }

  /* Closes all logger engines.
   */
  async close(){
    for(var k in this.engine){
      await this.engine[k].end();
    }
    await this.finish_state_observer;
  }

  /* dication has specific file length.
   */
  async rotate(fbasenm, keep_count, autoincrement){
    var ln = await (util.promisify(glob)(this.config.path + fbasenm + ".*"));
    var dl = ln.length > keep_count ? (ln.length - keep_count) : 0;
    var i = 1;
    for(var f of ln){
      // Deleting overflown
      if(i < dl){
        try{
          await fs.unlink(f);
        }catch(e){
          //
        }
      }else{
        var sp = f.split(path.sep);
        // some.log.0, some.log.1 ...
        var fn = sp.pop();
        var fnsp = fn.split(".");
        if(autoincrement){
          var n = parseInt(fnsp.pop()) + 1;
          var dst = sp.concat(fnsp.join(".")).join(path.sep) + "." + n;
          await fs.rename(f, dst);
        }
      }
      i++;
    }
  }

  colorify(s){
    for(var k in this.color_list){
      let to = new RegExp("<" + k + ">", "g");
      let tc = new RegExp("</" + k + ">", "g");
      if(s.match(to)){
        s = s.replace(to, this.color_list[k]);
        s = s.replace(tc, this.color_list.reset);
      }
    }
    return s;
  }

  decolorify(s){
    for(var k in this.color_list){
      let to = new RegExp("<" + k + ">", "g");
      let tc = new RegExp("</" + k + ">", "g");
      if(s.match(to)){
        s = s.replace(to, "");
        s = s.replace(tc, "");
      }
    }
    return s;
  }

  log(){
    return (this.config.level) ? this.engine.def.log.apply(this.engine.def, arguments) : false;
  }

  plain(t){
    return (this.config.level) ? this.engine.plain.log.apply(this.engine.plain, [t]) : false;
  }

  trace(t){
    return (this.config.level) ? this.engine.trace.log.apply(this.engine.trace, [t]) : false;
  }

  dictate(){
    return (this.config.level) ? this.engine.dictation.log.apply(this.engine.dictation, arguments) : false;
  }

}

class LoggerTransport_FileRotation_RuntimeBased extends winston.transports.File {

  constructor(opts){
    super(opts);
  }

  log(info){
    super.log.apply(this, arguments);
  }

}

class LoggerTransport_Database extends winston_transport {

  constructor(logger, opts) {
    super(opts);
    this.logger = logger;
    this.database = opts.database;
    this.connection = null;
    this.timestamp = new Date().getTime();

    switch(opts.level){
      case "dictation":
        this.schema = "colloquist_dictation";
        this.structure = {
          process_uuid: {
            type: "string"
          },
          uri: {
            type: "string"
          },
          status: {
            type: "string"
          },
          premise: {
            type: "object"
          },
          error: {
            type: "text"
          },
          memory: {
            type: "object"
          },
          started_at: {
            type: "datetime"
          },
          finished_at: {
            type: "datetime"
          },
        };
        break;
      default:
        this.schema = "colloquist_log";
        this.structure = {
          timestamp: {
            type: "datetime"
          },
          level: {
            type: "string"
          },
          process_uuid: {
            type: "string"
          },
          message: {
            type: "text"
          },
        };
        break;
    }
  }

  log(info, callback){
    var data = {
      process_uuid: this.logger.core.process_uuid,
      timestamp: new Date(),
      level: info.level,
    };

    switch(info.level){
      case "dictation":
        var psd = this.logger.decolorify(info.message);
        psd = JSON.parse(psd);
        data = FM.ob.merge({}, data, psd);
        break;
      default:
        data.message = this.logger.decolorify(info.message);
        break;
    }

    let conn = this.logger.core.database.connect(this.database);
    conn
      .then((r) => {
        /* If you define colloquist_log schema in your burden directory,
         * You can overrides whole behavior.
         */
        if(!r.bucket[this.schema]){
          // Forces to append SCHEMA to connection.bucket object.
          r.bucket[this.schema] = new (class extends this.logger.core.mixin.Schema {})(this.schema, r);
          return r.bucket[this.schema].define(this.structure);
        }else{
          return r.bucket[this.schema];
        }
      })
      .then((bucket) => {
        return bucket.create(data).then(() => {
          setTimeout(() => { this.emit('logged', info); }, 0);
        });
      })
      .then(callback)
      .catch((e) => {
        //
      });

  }

}
