/*
 * Requires chromedriver
 */
const TITLE = (function title(){
/*DOC

<cyan>   ___          .    .                                  .    </cyan>
<cyan> .'   \   __.   |    |     __.    ___.  ,   . -   ____ _/_   </cyan>
<cyan> |      .'   \  |    |   .'   \ .'   |  |   | |  (      |    </cyan>
<cyan> |      |    |  |    |   |    | |    |  |   | |  `--.   |    </cyan>
<cyan>  `.__,  `._.' /\__ /\__  `._.'  `---|. `._/| / \___.'  \__/ </cyan>
<cyan>                                     |/                      </cyan>

DOC*/
  var tag = "DOC";
  var reobj = new RegExp("/\\*"+tag+"\\n[\\s\\S]*?\\n"+tag+"\\*/", "m");
  var str = reobj.exec(title).toString();
  str = str.replace(new RegExp("/\\*"+tag+"\\n",'m'),'').toString();
  return str.replace(new RegExp("\\n"+tag+"\\*/",'m'),'').toString();
})();


const fs = require('fs').promises;
const fsx = require('fs-extra');
const path = require('path');
const nodemailer = require('nodemailer');
//

module.exports =
class colloquist {
  constructor(option){

    this.config = {};
    this.mailer = null;

    this.config.base = path.resolve([__dirname, '..'].join(path.sep));

    global._ = require("underscore");

    global.FM = require([this.config.base,'lib','vendor','fmjs','src','fm'].join(path.sep));

    global.disc = (p) => {
      return require([this.config.base,'lib',p].join(path.sep));
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
      command: {
        version: [
        ],
        help: [
        ],
        run: [
          {
            name: 'draft',
            alias: 'd',
            type: String,
            defaultOption: true
          },
          {
            name: 'headless',
            alias: 'h',
            type: Boolean
          },
          {
            name: 'gui',
            type: Boolean
          },
          {
            name: 'slomo',
            alias: 's',
            type: Number
          }
        ],
        create: [
        ]
      }
    };

    this.init(option || {});
    this.retrieve_arg();
  }

  init(option){
    this.require_config([this.config.base, 'burden', 'config', 'env', 'default'], ['path', 'mail', 'puppet', 'spice']);

    /* You have a chance to force-override default configurations on instantiation.
     * But this may be overriden by env & local configs later.
     */
    if(option){
      // config
      this.config = FM.ob.merge({}, this.config, option);
    }

    require('dotenv').config(this.config.path.app);
  }

  require_config(p, nms){
    var exists = false;
    var base = p.join(path.sep);
    for(var any of nms){
      exists = require(
        [ // gen config path.
          base,
          any + '.js'
        ].join(path.sep),
        this
      );
      if(exists){
        this.config[any] = exists;
      }
    }
  }

  async open(override){
    var any;
    // init other configs.
    var lacks = [];
    for(any of ["path", "puppet", "spice", "mail"]){
      var exists = false;
      // env override
      if(this.config.env){
        try{
          exists = await FM.async.import(
            [ // gen config path.
              this.config.path.config,
              'env', this.config.env, any+'.js'
            ].join(path.sep),
            this
          );
          if(exists){
            this.config[any] = FM.ob.merge({}, this.config[any] || {}, exists);
          }
        }catch(e){
          // do nothing
        }
      }
      // local overrides.
      try{
        exists = await FM.async.import([this.config.path.config, any+'.js'].join(path.sep), this);
        if(exists){
          this.config[any] = FM.ob.merge({}, this.config[any] || {}, exists);
        }
      }catch(e){
        // do nothing
      }
      // check existence
      if(!this.config[any]){
        lacks.push(any);
      }
    }

    this.config = FM.ob.merge(this.config, override || {});

    if(lacks.length){
      throw "Failed to assign configuration => " + lacks.join(", ");
    }

    // loads up vendors.
    [ 'puppeteer',
      'winston',
    ].map((a) => {
      this.vendor[a] = require(a);
    });

    this.logger = new (disc('class/Logger'))({
      path: this.config.path.log + path.sep
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

  async execute(){
    switch(this.arg.command){
      case "run":
        await this.recite(this.arg.param.draft);
        break;
      case "create":
        await this.move_burden();
        break;
      case "version":
        this.logger.plain({
          level: 'info',
          message: TITLE
        });
        break;
    case "help":
        this.logger.plain({
          level: 'info',
          message: TITLE
        });
        console.log('no-helps');
        break;
      default:
        this.log_warn("Unknown command: " + this.arg.command);
        break;
    }
  }

  async load_draft(draft_name){
    if(!draft_name){
      throw "Draft name should be supplied.";
    }
    var dpath = [this.config.path.shelf,'draft',draft_name + '.js'].join(path.sep);
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
    var buf = await fs.readFile(this.logger.active_dictation_log);
    var log = buf.toString();
    var spl = log.split("\n").filter((e) => { return e.length > 0; });
    await this.send_report('default/report.dictation', {
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
    let argv;
    let cmd;
    let act = "";

    cmd = c(this.command_behavior.main, {stopAtFirstUnknown: true});
    argv = cmd._unknown || [];

    if(!cmd.name){
      act = 'help';
    }else{
      act = cmd.name;
    }

    let opt = this.command_behavior.command[act];
    if(!opt){
      throw "COMMAND:" + act + " is not defined as valid sequence.";
    }

    cmd = c(opt, {argv, stopAtFirstUnknown: true});
    argv = cmd._unknown || [];
    switch(act){
      case "run":
        for(var k in cmd){
          switch(k){
            case "slomo":
            case "headless":
              this.config.puppet[k] = cmd[k];
              break;
            case "gui":
              this.config.puppet['headless'] = !cmd[k];
              break;
          }
        }
        break;
      case "create":
        break;
      default:
        break;
    }

    this.arg = {
      command: act,
      param: cmd,
    }

  }

  async move_burden(){
    await fsx.copy(
      [this.config.base, 'burden'].join(path.sep),
      [process.cwd(), 'burden'].join(path.sep),
      {
        overwrite: true
      }
    )
    return;
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
      this.log_error(e);
    }
  }

  async send_report(template, param){
    var p = param || {};
    try{
      var f = [this.config.path.shelf, 'template','mail',template + '.ejs'].join(path.sep);
      var tbuf = await fs.readFile(f);
      var render = _.template(tbuf.toString());
      p.type = param.type || this.config.mail.report.default.type;
      p[p.type] = render(p.data || {});
      return await this.send_mail(p);
    }catch(e){
      this.log_error(e);
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
