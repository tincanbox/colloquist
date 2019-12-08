/*
 * Requires chromedriver
 */
const heardoc = (docf) => {
  return docf.toString()
    .match(/(?:\/\*(?:[\s\S]*?)\*\/)/)
    .pop()
    .replace(/^\/\*/, "")
    .replace(/\*\/$/, "");
}

const TITLE = heardoc(function(){/*

<cyan>   ___          .    .                                  .    </cyan>
<cyan> .'   \   __.   |    |     __.    ___.  ,   . -   ____ _/_   </cyan>
<cyan> |      .'   \  |    |   .'   \ .'   |  |   | |  (      |    </cyan>
<cyan> |      |    |  |    |   |    | |    |  |   | |  `--.   |    </cyan>
<cyan>  `.__,  `._.' /\__ /\__  `._.'  `---|. `._/| / \___.'  \__/ </cyan>
<cyan>                                     |/                      </cyan>

*/});


const fs = require('fs');
const fsp = fs.promises;
const fsx = require('fs-extra');
const path = require('path');
const portable = 'burden';
//
module.exports = class colloquist {

  /*
   * ( Object = Options.
   * ) => this
   *
   * Options {
   *   burden: 'burden path'
   * }
   *
   */
  constructor(option){

    this.config = {
      label: undefined,
      stage: undefined,
      base: path.resolve([__dirname, '..'].join(path.sep)),
      list: ['debug', 'mail', 'puppet', 'spice', 'database', 'server'],
    };

    global._ = require("underscore");

    global.FM = require([this.config.base,'lib','vendor','fmjs','src','fm'].join(path.sep));

    global.disc = (p) => {
      return require([this.config.base,'lib',p].join(path.sep));
    }

    this.arg = {};
    this.helper = {};

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
          { name: 'draft',
            alias: 'd',
            type: String,
            defaultOption: true },
          { name: 'headless',
            alias: 'h',
            type: Boolean },
          { name: 'gui',
            type: Boolean },
          { name: 'slomo',
            alias: 's',
            type: Number }
        ],
        create: [
        ],
        server: [
          { name: 'name',
            alias: 'n',
            type: String
          }
        ]
      }
    };

    this.init(option || {});
    this.retrieve_arg();
  }

  /*
   * ( ?Object = Options for instatiation of colloquist.
   * ) => colloquist
   *
   * option = {
   *   burden: burden directory path.
   * }
   */
  init(option){
    /* if you want to change burden path,
     * just call...
     *
     * new colloquist({
     *   burden: 'YOUR_BURDEN_PATH'
     * })
     */
    if(!option[portable]){
      option[portable] = [path.dirname(require.main.filename), portable].join(path.sep);
    }

    this.config[portable] = option[portable];

    let base = [this.config[portable]];

    // init config form.
    for(var k of this.config.list){
      this.config[k] = {};
    }

    /* We have a chance to force-override default configurations on instantiation.
     * But this may be overriden by stage & local configurations later.
     */

    /* portable directory can hold .env files.
     */
    require('dotenv').config(this.config[portable]);

    /* Loads ini file.
     * defines whole paths in app.
     */
    this.require_config(base, new RegExp("ini\\.js"));

    /* Loads colloquist default configurations.
     */
    this.require_config(([this.config.path.config, 'stage', 'default']), this.config.list);

    /* init other configs.
     */
    this.require_config(this.config.path.config, new RegExp("local\\.js"));
    if(this.config.stage){
      this.require_config(([this.config.path.config, 'stage', this.config.stage]), this.config.list);
    }else{
      console.log("Notice: failed to retrieve config.stage value; can be supplied via burden/ini.js or burden/config/local.js");
    }
    this.require_config(this.config.path.config, this.config.list);
    this.require_config(this.config.path.config, new RegExp("(.*)\\.js"));

    this.database = new (disc("class/Database"))(this);
    this.server = new (disc("class/Server"))(this);

    this.mail = new (disc("class/Mail"))(this);
    this.space = new (disc("class/Space"))(this);
    this.scenario = new (disc("class/Scenario"))(this);
    this.template = new (disc("class/Template"))(this);

    return this;
  }

  /* dependencies: FM
   * ( Object = Config overrides.
   * ) => colloquist
   */
  async open(override){

    /* Further overrides.
     * colloquist.open(OVERRIDE) is prior to new colloquist(OVERRIDE)
     */
    this.config = FM.ob.merge({}, this.config, override || {});
    this.validate_config();

    // loads up vendors.
    [ 'puppeteer:puppeteer-core',
      'winston',
    ].map((a) => {
      var s = a.split(":");
      var v = s[0];
      for(var inc of s.reverse()){
        try{
          this.vendor[v] = require(inc);
        }catch(e){
          // console.log("failed", inc);
        }
      }
    });

    /* Launchs Winston logger.
     */
    this.logger = new (disc('class/Logger'))({
      path: this.config.path.log + path.sep
    });

    await this.logger.init();

    /* Bind process events.
     */
    process.on('uncaughtRejection', (reason, p) => {
      this.log_warn('Unhandled Rejection at:', p, 'reason:', reason);
    });

    process.on('warning', e => console.warn(FM.vr.stringify(e)));

    process.on('uncaughtException', async (err) => {
      err.message = "UNCAUGHT EXCEPTION => " + err.message;
      this.log_error(err);
      await this.mail.send_report('default/core.uncaught_exception', {
        subject: 'CRITICAL: UNCAUGHT EXCEPTION',
        data: {
          error: err
        }
      });
    });

    return this;
  }

  /* Redirects args to actual actions.
   * This method requires retrieave_arg call.
   *
   * ( void
   * ) => void
   */
  async execute(){
    switch(this.arg.command){
      case "run":
        await this.recite(this.arg.param.draft);
        break;
      case "server":
        await this.server.start(this.arg.param.name || "default");
        break;
      case "create":
        await this.copy_portable(process.cwd());
        break;
      case "version":
        this.logger.plain({
          level: 'info',
          message: TITLE
        });
        console.log("VERSION: ");
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

  /*
   * ( void
   * ) => void | throw Error
   */
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
   * ( Array = path components
   *   Array | String = Loads
   *   Boolean = a switch for whole or named replacement.
   * ) => Nothing
   */
  require_config(pp, nms){
    var base = (FM.vr.is_a(pp) ? pp : [pp]).join(path.sep);
    try{
      /* loads local files as whole override of configurations.
       * This is just for singleton configuration for each environment.
       */
      var fpath = '';
      if(FM.vr.is_s(nms)){
        this.override_config([base, nms].join(path.sep), nms);
      }else if(nms instanceof RegExp){
        let mtchs = fs.readdirSync(base);
        for(var m of mtchs){
          fpath = [base, m].join(path.sep);
          var cnm = m.replace(/\.js$/, "");
          var knm = null;

          if(!fs.lstatSync(fpath).isFile()){
            continue;
          }

          if(!m.match(nms)){
            continue;
          }

          /* if, is def configs */
          if(this.config.list.indexOf(cnm) >= 0){
            knm = cnm;
          }

          this.override_config(fpath, knm);
        }
      }
      else if(nms instanceof Array){
        for(var any of nms){
          this.require_config([base], any);
        }
      }

      return this;
    }catch(e){
      // do something
    }
  }

  /*
   */
  async override_config(path, any){
    try{
      // retrieve
      var exists = require(path);
      if(FM.vr.is_f(exists)){
        exists = exists(this);
      }
      // dest name.
      if(any){
        this.config[any] = FM.ob.merge({}, this.config[any] || {}, exists);
      }else{
        this.config = FM.ob.merge({}, this.config, exists);
      }
    }catch(e){
      // do nothing
    }
  }

  /*
   */
  async launch(n){
    // This should be a singleton.
    await this.space.launch(n);
    return this;
  }

  /*
   */
  async recite(draft){
    var d = draft || this.arg.param.draft || false;
    try {
      return await this.run(d);
    }catch(e) {
      this.debug("Exception@colloquist.recite");
      this.log_error(e);
      await this.mail.send_report('default/core.recite_exception', {
        subject: 'Scenario Error Report',
        data: {
          arg: this.arg,
          draft: d,
          result: this.result,
          error: e
        }
      });
      return this;
    }finally{
      await this.mail.send_dictation_report();
      await this.exit();
    }
  }

  /* ( draft:string|object
   *   param:object Can be overriden shared-premise.
   * ) -> Promise -> Colloquist
   */
  async run(draft, param){
    var d = draft || this.arg.param.draft || false;

    this.debug("Reciting stories....");

    var dr = await this.scenario.load_draft(d);
    var result = await this.scenario.scribe(dr, param);

    this.result.data = result;
    this.result.status = (this.result.error.length == 0);

    return this;
  }

  /*
   */
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

  /*
   */
  async copy_portable(loc){
    try{
      await fsx.copy(
        [this.config.base, portable].join(path.sep),
        [loc, portable].join(path.sep),
        {
          // do nothing
          overwrite: false
        }
      );
      await fsx.copy(
        [this.config.base, 'run', 'app.js'].join(path.sep),
        [loc, 'run', 'app.js'].join(path.sep)
      );
    }catch(e){
      //
    }
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

  /*
   * ( Any
   * ) => Nothing
   */
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

  /*
   * ( String
   * ) => Nothing
   */
  log_warn(str){
    this.logger.plain({
      level: 'warning',
      message: "<yellow>" + str + "</yellow>"
    });
  }

  debug(e){
    if(this.config.debug.log === false){
      return;
    }
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
