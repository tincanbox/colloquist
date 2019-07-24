/*
 * Requires chromedriver
 */

const fs = require("fs").promises;
const path = require("path");
const util = require("util");
const URL = require("url");
const nodemailer = require('nodemailer');
require('dotenv').config();
//

module.exports =
class Core {
  constructor(o){

    this.config = {};
    this.mailer = null;

    this.init(o);

    global._ = require("underscore");

    global.FM = require(this.config.path.lib + "vendor/fmjs/src/fm");

    global.disc = (p) => {
      return require(this.config.path.lib + p);
    }

    this.arg = {};
    this.draft = {};
    this.helper = {};

    const Scenario = disc("class/Scenario");
    const Space = disc("class/Space");
    this.space = new Space(this);
    this.scenario = new Scenario(this);

    this.vendor = {};
    this.result = {
      status: false,
      data: [],
      error: []
    };
    this.command_behavior = {
      main: { name: 'name', defaultOption: true },
      common: [
        {
          name: 'headless',
          alias: 'h',
          type: Boolean
        },
        {
          name: 'slomo',
          alias: 's',
          type: Number
        },
        {
          name: 'draft',
          alias: 'd',
          type: String
        }
      ],
      command: {
        run: [
          {name: 'draft', 'defaultOption': true}
        ]
      }
    };

  }

  init(o){
    if(o.config){
      try{
        this.config = require(o.config);
        if(this.config instanceof Function){
          this.config = this.config(o);
        }
      }catch(e){
        throw "Failed to load core config file: " + o.config + " [" + e.message + "]";
      }
    }else{
      throw "The 'config' property should be implemented at instantiation.";
    }
  }

  async open(){
    var any;

    // init other configs.
    for(any of ["puppet", "spice", "mail"]){
      this.config[any] = await FM.async.import(this.config.path.config + any, this);
    }

    this.retrieve_arg();

    // loads up vendors.
    [ 'puppeteer',
      'winston',
    ].map((a) => {
      this.vendor[a] = require(a);
    });

    this.logger = new (disc('class/Logger'))({
      path: this.config.path.log
    });

    await this.logger.init();

    process.on('uncaughtRejection', (reason, p) => {
      this.log_warn('Unhandled Rejection at:', p, 'reason:', reason);
    });

    process.on('warning', e => console.warn(FM.vr.stringify(e)));

    process.on('uncaughtException', async (err) => {
      err.message = "UNCAUGHT EXCEPTION => " + err.message;

      this.log_error(err);

      await this.send_report('default/core_uncaught_exception', {
        subject: 'CRITICAL: UNCAUGHT EXCEPTION',
        data: {
          error: err
        }
      });
    });

    return this;
  }

  async load_draft(draft_name){
    if(!draft_name){
      throw "Draft name should be supplied.";
    }
    var dpath = this.config.path.board + "draft/" + draft_name + ".js";
    if(await fs.stat(dpath)){
      this.draft[draft_name] = await FM.async.import(dpath, this);
    }else{
      throw new Error("Failed to find draft => " + dpath);
    }
    return this.draft[draft_name];
  }

  async launch(n){
    // This should be a singleton.
    await this.space.launch(n);
    return this;
  }

  async recite(draft_name){
    try {
      var d = draft_name || this.arg.draft || false;
      var dr = await this.load_draft(d);

      var r = !this.validate_draft(d);
      if(r){
        this.error("Failed to load draft named: " + d);
      }

      this.debug('Launching Puppeteer');
      await this.launch();

      this.debug("Reciting stories....");
      var result = await this.scenario.scribe(dr);
      this.result.data = result;
      this.result.status = (this.result.error.length == 0);

      await this.send_dictation_report();

      return this;
    }catch(e) {
      this.debug("recite global error");
      this.log_error(e);
      await this.send_report('default/core_recite_exception', {
        subject: 'Scenario Error Report',
        data: {
          arg: this.arg,
          draft: draft_name,
          result: this.result,
          error: e
        }
      });
      return this;
    }finally {
      await this.send_result_report();
      await this.exit();
    }
  }

  async send_result_report(){
    await this.send_report('default/report.result', {
      type: 'html',
      subject: 'GLOBAL: Excecution Result',
      data: {
        result: this.result
      }
    });
  }

  async send_dictation_report(){
    console.log(this.logger.active_dictation_log);
    var buf = await fs.readFile(this.logger.active_dictation_log);
    var log = buf.toString();
    var spl = log.split("\n").filter((e) => { return e.length > 0; });
    await this.send_report('default/dictation_report', {
      type: 'html',
      subject: 'GLOBAL: Dictation Report',
      data: {
        dictation_list: spl.map((r) => {
          return JSON.parse(r);
        })
      }
    });
  }

  retrieve_arg(){
    let c = require('command-line-args');
    let cmd = c(this.command_behavior.main, { stopAtFirstUnknown: true });

    if(cmd.name == ''){
      cmd.name = 'run';
    }

    let opt = this.command_behavior.command[cmd.name];
    if(!opt){
      throw "COMMAND:" + cmd.name + " is not defined as valid sequence.";
    }

    opt = c(opt, { stopAtFirstUnknown: true });
    switch(cmd.name){
      case "run":
        break;
      default:
        break;
    }

    this.arg = c(this.command_behavior.common);
    for(var k in this.arg){
      switch(k){
        case "slomo":
        case "headless":
          this.config.puppet[k] = this.arg[k];
          break;
      }
    }
  }

  /*
   */
  async exit(){
    if(this.space){
      this.debug("Closing instance...");
      await this.space.close();
    }else{
      this.debug("No Space is opened.");
    }

    this.log("<yellow>fin.</yellow>");

    if(this.result.error.length > 0){
      this.debug("<red>Process finished with failures.</red>");
      return;
    }

    return this;
  }

  /*
   */
  validate_draft(draft_name){
    if(this.draft[draft_name]){
      return true;
    }
    return false;
  }

  async send_mail(param){
    param = param || {};
    if(!this.mailer){
      this.mailer = nodemailer.createTransport(this.config.mail.report.server);
    }
    try{
      var o = {
        from: this.config.mail.report.from,
        to: param.to || this.config.mail.report.default.to,
        subject: param.subject || this.config.mail.report.default.subject
      };
      // body
      var type = param.type || this.config.mail.report.default.type;
      o[type] = param[type];
      // send
      var res = await this.mailer.sendMail(o);
      return res;
    }catch(e){
      this.log_warn(e.message);
    }
  }

  async send_report(template, param){
    var p = p || {};
    try{
      var tbuf = await fs.readFile(this.config.path.board + 'template/mail/' + template + '.ejs');
      var render = _.template(tbuf.toString());
      p.type = param.type || this.config.mail.report.default.type;
      p[p.type] = render(p.data || {});
      return await this.send_mail(p);
    }catch(e){
      this.log_warn(e.message);
    }
  }

  /* async function
   * ( String
   *   [String]
   *   [Integer]
   * )
   */
  log(msg, lvl, depth){
    let p = (new Error).stack.split("\n")[(depth || 2)];
    let l = p.replace(/\s+at\s+/, "");
    this.logger.log({
      level: lvl || 'info',
      prev: l.replace(this.config.path.base, ""),
      message: msg
    });
  }

  log_error(e){
    try{
      var err = FM.vr.stringify(e);
      this.result.error.push(err);
      this.logger.plain({
        level: 'error',
        message: "<red>" + err + "</red>"
      });
    }catch(e){ console.log(e); }

  }

  log_warn(str){
    this.logger.plain({
      level: 'warning',
      message: "<yellow>" + str + "</yellow>"
    });
  }

  debug(e){
    this.logger.log({
      level: 'debug',
      message: "<cyan>" + e + "</cyan>"
    });
  }

  error(e){
    if(e instanceof Error){
      //
    }else{
      e = new ScrapBookError(e);
    }
    throw e;
  }

}

class ScrapBookError extends Error {}
