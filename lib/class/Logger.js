const winston = require('winston');
const winston_dailyrotate = require('winston-daily-rotate-file');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const glob = require("glob");

module.exports = class Logger {

  constructor(conf){

    this.engine = {};
    this.config = conf;

    this.levels = {
      emerg: 0,
      alert: 1,
      crit: 2,
      error: 3,
      warning: 4,
      notice: 5,
      info: 6,
      debug: 7,
      trace: 99
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
      trace: "white"
    };

    if(this.config.level == "all"){
      this.config.level = "trace";
    }

    winston.addColors(this.colors);

    this.format_app = (type) => {
      return winston.format.printf((info, o) => {
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
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            this.format_app("console")
          )
        }),
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
        }),
      ]
    });

    this.engine.plain = winston.createLogger({
      level: this.config.level,
      levels: this.levels,
      format: winston.format.combine(
        this.format_plain()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            this.format_plain("console")
          )
        }),
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
        }),
      ]
    });

    this.engine.trace = winston.createLogger({
      level: this.config.level,
      levels: this.levels,
      format: winston.format.combine(
        winston.format.printf(info => {
          return info.message;
        })
      ),
      transports: [
        new (winston.transports.DailyRotateFile)({
          level: 'trace',
          filename: this.config.path + 'trace.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.rotation.size,
          maxFiles: this.config.rotation.term
        })
      ]
    });

    await this.rotate('dictation.log', this.config.rotation.count.dictation, false);

    this.active_dictation_log = this.config.path + 'dictation.log.' + (this.active_time);

    this.engine.dict = winston.createLogger({
      level: 'trace',
      levels: this.levels,
      format: winston.format.combine(
        this.format_plain()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            this.format_plain("console")
          )
        }),
        new (winston.transports.File)({
          filename: this.active_dictation_log
        })
      ]
    });

    this.color_list = {
      black   : '\u001b[30m',
      red     : '\u001b[31m',
      green   : '\u001b[32m',
      yellow  : '\u001b[33m',
      blue    : '\u001b[34m',
      magenta : '\u001b[35m',
      cyan    : '\u001b[36m',
      white   : '\u001b[37m',
      reset   : '\u001b[0m'
    }

  }

  async rotate(fbasenm, keep_count, autoincrement){
    var ln = await (util.promisify(glob)(this.config.path + fbasenm + ".*"));
    var dl = ln.length > keep_count ? (ln.length - keep_count) : 0;
    var i = 1;
    // Rotate
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
      let tc = new RegExp("<\/" + k + ">", "g");
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
      let tc = new RegExp("<\/" + k + ">", "g");
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

  dictate(t){
    return (this.config.level) ? this.engine.dict.log.apply(this.engine.dict, [t]) : false;
  }

}
