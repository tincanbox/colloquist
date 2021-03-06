const fs = require('fs').promises;
const path = require('path');

const winston = require('winston');
const winston_transport = require('winston-transport');
require('winston-daily-rotate-file');
require('winston-mongodb');

module.exports = class Logger {

  constructor(core){

    this.core = core;
    this.engine = {};
    this.dictation_engine_list = [];
    this.config = this.core.config.logger;

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
      debug: "grey",
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
    if(this.config.level === "all"){
      this.config.level = "trace";
    }

    this.transport_list = {};
    this.config.path = this.core.config.path.log + path.sep;

    // Transports default for File
    this.transport_list.file = {
      error: {
        level: 'error',
        filename: this.config.path + 'error.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: this.config.rotation.size,
        maxFiles: this.config.rotation.term
      },
      warning: {
        level: 'warning',
        filename: this.config.path + 'warning.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: this.config.rotation.size,
        maxFiles: this.config.rotation.term
      },
      other: {
        level: 'trace',
        filename: this.config.path + 'app.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: this.config.rotation.size,
        maxFiles: this.config.rotation.term
      }
    };

    this.format_app = (type) => {
      return winston.format.printf((info) => {
        let d = new Date;
        let sep = " | ";
        let dst =
          d.getFullYear()
          + "-" + ("0"+(d.getMonth()+1)).slice(-2)
          + "-" + ("0" + d.getDate()).slice(-2)
          + " " + ("0" + d.getHours()).slice(-2)
          + ":" + ("0" + d.getMinutes()).slice(-2)
          + ":" + ("0" + d.getSeconds()).slice(-2);

        return (dst + sep + info.level.toUpperCase() + sep
          + (info.prev
            ? info.prev + sep
            : (info.trace ? info.trace[0].file + ":" + info.trace[0].line + sep : "")
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

    this.format_stamped = (type) => {
      return winston.format.printf(info => {
        let tm = new Date().toISOString();
        return (
            (type === "console")
            ? this.colorify(info.message)
            : (tm + "\t" + this.decolorify(info.message))
          );
      });
    }

    this.format_plain = (type) => {
      return winston.format.printf(info => {
        return (
            (type === "console")
            ? this.colorify(info.message)
            : this.decolorify(info.message)
          );
      });
    }

  }

  async init(){

    this.engine.main = winston.createLogger({
      level: this.config.level,
      levels: this.levels,
      format: winston.format.combine(
        this.format_app()
      ),
      transports: await this.generate_transport('main')
    });

    this.engine.plain = winston.createLogger({
      level: this.config.level,
      levels: this.levels,
      format: winston.format.combine(
        this.format_stamped()
      ),
      transports: await this.generate_transport('usual')
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

    /* Attaches `finish` event and keep it pending,
     * until Logger.close() is called.
     */
    this.finish_state_observer = Promise.all((() => {
      let ts = [];
      for(let k in this.engine)
        for(let transport of this.engine[k].transports){
          let p = new Promise((res) => {
            transport.on('finish', res);
          });
          ts.push(p);
        }
      return ts;
    })());

  }

  async bind_scenario_dictation(scenario){
    let s = scenario;

    await this.rotate('dictation.log', this.config.rotation.count.dictation, false);

    let filename
      = this.core.config.path.log
      + path.sep + 'dictation.log.' + s.process_uuid;

    let t = await this.generate_transport('dictation', {
      file: {
        filename: filename
      }
    });

    s.dictation_engine = winston.createLogger({
      level: 0,
      levels: this.levels,
      format: winston.format.combine(
        this.format_plain()
      ),
      transports: t
    });

    this.dictation_engine_list.push(s.dictation_engine);
  }

  async generate_transport(name, opt){
    let transport = [];
    let dbs = this.config.output.filter(r => r.match(/^database/)).map((a) => a.replace(/^database:/, ""));

    switch(name){
      case "main":
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
            new (winston.transports.DailyRotateFile)(this.transport_list.file.error),
            new (winston.transports.DailyRotateFile)(this.transport_list.file.warning),
            new (winston.transports.DailyRotateFile)(this.transport_list.file.other)
          );

        if(dbs.length)
          dbs.forEach(db => {
            transport.push(
              new LoggerTransport_Database(this, {
                database: db,
                level: 'trace',
                format: winston.format.printf(info => info.message)
              })
            )
          });

        break;

      case "usual":
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
            new (winston.transports.DailyRotateFile)(this.transport_list.file.error),
            new (winston.transports.DailyRotateFile)(this.transport_list.file.warning),
            new (winston.transports.DailyRotateFile)(this.transport_list.file.other)
          );

        if(dbs.length)
          dbs.forEach(db => {
            transport.push(
              new LoggerTransport_Database(this, {
                level: 'trace',
                database: db,
                format: winston.format.printf(info => info.message)
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
                level: 'trace',
                format: winston.format.printf(info => info.message)
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
            new (winston.transports.File)(opt.file)
          );

        if(dbs.length)
          dbs.forEach(db => {
            transport.push(
              new LoggerTransport_Database(this, {
                level: 'dictation',
                database: db,
                format: winston.format.printf(info => info.message)
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
    let k;
    await Promise.all(this.dictation_engine_list.map((eng) => {
      return eng.end();
    }));
    for(k in this.engine){
      await this.engine[k].end();
    }
    await this.finish_state_observer;
    await Promise.all(this.dictation_engine_list.map((eng) => {
      return eng.close();
    }));
    for(k in this.engine){
      await this.engine[k].close();
    }
  }

  /* dication has specific file length.
   * THIS SHOULD BE CALLED BEFORE creatLogger !!
   */
  async rotate(fbasenm, keep_count, autoincrement){
    let files = await fs.readdir(path.dirname(this.config.path + fbasenm));
    files = files.filter((f) => {
      return f.match(fbasenm);
    });
    files = await Promise.all(files.map((fname) => {
      return (async (fname) => {
        try{
          let st = await fs.stat(this.config.path + fname);
          return {
            file: fname,
            ctime: st.ctime
          };
        }catch(e){
          return false;
        }
      })(fname);
    }));
    files = files.filter(r => r).sort((a, b) => {
      return a.ctime > b.ctime;
    });
    let dl = (files.length > keep_count) ? (files.length - keep_count) : 0;
    let i = 0;
    for(let f of files){
      // Deleting overflown
      if(dl && i <= dl){
        try{
          await fs.unlink(this.config.path + f.file);
        }catch(e){
          //
        }
      }else{
        // some.log.0, some.log.1 ...
        if(autoincrement){
          let fn = f.file;
          let fnsp = fn.split(".");
          let inc = fnsp.pop();
          let nnm = 0;
          let nfn = "";
          if(inc.match(/^[0-9]+$/)){
            nnm = parseInt(fnsp.pop()) + 1;
            nfn = fnsp.join(".");
          }else{
            //
            nfn = fn;
          }
          let dst = this.config.path + nfn + "." + nnm;
          await fs.rename(f, dst);
        }
      }
      i++;
    }
  }

  colorify(s){
    for(let k in this.color_list){
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
    for(let k in this.color_list){
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
    return (this.config.level) ? this.engine.main.log.apply(this.engine.main, arguments) : false;
  }

  plain(t){
    return (this.config.level) ? this.engine.plain.log.apply(this.engine.plain, [t]) : false;
  }

  trace(t){
    return (this.config.level) ? this.engine.trace.log.apply(this.engine.trace, [t]) : false;
  }

  /* ( e:string
   * ) -> Nothing
   */
  debug(e){
    this.log({
      level: 'debug',
      message: "<cyan>" + e + "</cyan>"
    });
  }

  /* ( Any
   * ) -> Nothing
   */
  info(str){
    this.plain({
      level: 'info',
      message: "<grey>" + str + "</grey>"
    });
  }

  /* ( Any
   * ) -> Nothing
   */
  warning(str){
    this.plain({
      level: 'warning',
      message: "<yellow>" + str + "</yellow>"
    });
  }

  /* ( Any
   * ) -> Nothing
   */
  error(e, fn){
    try{
      let err = FM.vr.stringify(e);
      this.plain({
        level: 'error',
        message: "<red>" + (fn ? fn(err) : err) + "</red>"
      });
    }catch(e){ e.message = "LogErr:" + e.message; console.log(e); }
  }

}

class LoggerTransport_Database extends winston_transport {

  /* Database Log
   */
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
            type: "string",
            index: true
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
            type: "array"
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

  /* Database Log
   */
  log(info, callback){
    let data = {
      process_uuid: this.logger.core.process_uuid,
      timestamp: new Date(),
      level: info.level,
    };

    let psd = this.logger.decolorify(info.message);
    switch(info.level){
      case "dictation":
        psd = JSON.parse(psd);
        data = {...data, ...psd};
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
          console.error('Logger Database Connection Error: ', e);
      });

  }

}
