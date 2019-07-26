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
const portable = 'burden';
//

module.exports =
class colloquist {
  constructor(option){

    this.config = {
      label: 'colloquist-app',
      stage: 'devel',
      base: path.resolve([__dirname, '..'].join(path.sep)),
      list: ['path', 'mail', 'puppet', 'spice'],
    };

    this.mailer = {};

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
      common: [
        {
          name: portable,
          type: String
        }
      ],
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

    this.retrieve_arg();
    this.init(option || {});
  }

  /*
   */
  init(option){

    if(!option[portable]){
      option[portable] = path.dirname(require.main.filename) + path.sep;
    }

    this.config[portable] = option[portable];

    let base = [this.config[portable], portable];

    /* Loads colloquist default configurations.
     */
    this.require_config(base.concat(['config', 'stage', 'default']), this.config.list);

    /* We have a chance to force-override default configurations on instantiation.
     * But this may be overriden by stage & local configurations later.
     */

    require('dotenv').config(this.config[portable]);

    // init other configs.
    this.require_config(base.concat(['config', 'stage', this.config.stage]), this.config.list);
    this.require_config(base.concat(['config']), this.config.list);
    this.require_config(base.concat(['config']), ['local'], true);
  }

  /* dependencies: FM
   */
  async open(override){

    /* Further overrides.
     * colloquist.open(OVERRIDE) is prior to new colloquist(OVERRIDE)
     */
    this.config = FM.ob.merge({}, this.config, override || {});
    console.log(this.config);

    this.validate_config();

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
      await this.send_report('default/core.uncaught_exception', {
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
        await this.copy_portable(process.cwd());
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

  validate_config(){
    var lack = [];
    for(var any of this.config.list){
      if(!this.config[any]){
        lack.push(any);
      }
    }
    if(lack.length){
      throw "Invalid configuration with " + lack.join(", ");
    }
  }

  /*
   */
  require_config(pp, nms, replace){
    var exists = false;
    var base = pp.join(path.sep);
    try{
      for(var any of nms){
        exists = require(
          [ // gen config path.
            base,
            any + '.js'
          ].join(path.sep),
          this
        );
        if(exists){
          if(FM.vr.is_f(exists)){
            exists = exists(this);
          }
          if(replace){
            this.config = FM.ob.merge({}, this.config || {}, exists);
          }else{
            this.config[any] = FM.ob.merge({}, this.config[any] || {}, exists);
          }
        }
      }
    }catch(e){
      // do
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
      await this.send_report('default/core.recite_exception', {
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
      //await this.send_result_report();
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

  async copy_portable(loc){
    await fsx.copy(
      [this.config.base, portable].join(path.sep),
      [loc, portable].join(path.sep),
      {
        overwrite: false
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

  async send_mail(host, param){
    param = param || {};
    if(!this.mailer[host]){
      this.mailer[host] = nodemailer.createTransport(this.config.mail[host].server);
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
      var f = [this.config.path.shelf, 'template','mail',template+'.ejs'].join(path.sep);
      var tbuf = await fs.readFile(f);
      var render = _.template(tbuf.toString());
      p.type = param.type || this.config.mail.report.default.type;
      p[p.type] = render(p.data || {});
      return await this.send_mail('report', p);
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
