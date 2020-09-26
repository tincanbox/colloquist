/*
 * Requires chromedriver
 */
const heredoc = (docf) => {
  let c = docf.toString().match(/(?:\/\*(?:[\s\S]*?)\*\/)/);
  return c.pop().replace(/^\/\*/, "").replace(/\*\/$/, "");
}

const TITLE = heredoc(() => {/*

<cyan>   ___          .    .                                  .    </cyan>
<cyan> .'   \   __.   |    |     __.    ___.  ,   . -   ____ _/_   </cyan>
<cyan> |      .'   \  |    |   .'   \ .'   |  |   | |  (      |    </cyan>
<cyan> |      |    |  |    |   |    | |    |  |   | |  `--.   |    </cyan>
<cyan>  `.__,  `._.' /\__ /\__  `._.'  `---|. `._/| / \___.'  \__/ </cyan>
<cyan>                                     |/                      </cyan>

*/});

const VERSION = '2.0.0';

const fs = require('fs');
const fsx = require('fs-extra');
const path = require('path');
const uuid = require('uuid/v4');
const portable = 'burden';
//
module.exports = class colloquist {

  /*
   * ( Object = Options.
   * ) -> this
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
      list: ['debug', 'logger', 'mail', 'puppet', 'spice', 'database', 'server'],
    };

    global._ = require("lodash");
    global.FM = require([this.config.base,'lib','vendor','fmjs','src','fm'].join(path.sep));
    global.disc = (p) => require([this.config.base,'lib',p].join(path.sep));

    this.__is_opened = false;

    this.command = {};
    this.helper = {};
    this.mixin = {};
    this.vendor = {};

    this.command_behavior = {
      main: { name: 'name', defaultOption: true },
      common: [
        { name: portable,
          type: String }
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
          { name: 'param',
            alias: 'p',
            multiple: true,
            type: String },
          { name: 'headless',
            alias: 'h',
            type: Boolean },
          { name: 'gui',
            type: Boolean },
          { name: 'slomo',
            alias: 's',
            type: Number },
        ],
        tell: [
          { name: 'name',
            alias: 'n',
            type: String,
            defaultOption: true },
          { name: 'param',
            alias: 'p',
            multiple: true,
            type: String }
        ],
        create: [
        ],
        server: [
          { name: 'name',
            alias: 'n',
            type: String,
            defaultOption: true },
          { name: 'option',
            alias: 'o',
            multiple: true,
            type: String }
        ]
      }
    };

    this.init(option || {});
  }

  /*
   * ( ?Object = Options for instatiation of colloquist.
   * ) -> this
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
     *
     * When portable is emply, Colloquist treats app having
     * the entry point like PROJECT_ROOT/index.js.
     */
    if(!option[portable]){
      option[portable] = [path.dirname(require.main.filename), portable].join(path.sep);
    }

    this.config[portable] = option[portable];

    // init config form.
    for(let k of this.config.list){
      this.config[k] = {};
    }

    /* We have a chance to force-override default configurations on instantiation.
     * But this may be overriden by stage & local configurations later.
     */

    /* portable(burden) directory can hold .env files.
     */
    require('dotenv').config({
      path: this.config[portable] + path.sep + ".env"
    });

    /* Loads ini file. defines whole paths in app.
     * Overrides default if local burden is ready.
     */
    this.require_config(this.config.base + path.sep + portable, new RegExp("ini\\.js"));
    this.require_config([this.config[portable]], new RegExp("ini\\.js"));

    /* Loads colloquist default configurations.
     */
    this.require_config(([this.config.path.config, 'stage', 'default']), this.config.list);

    /* init other configs.
     */
    this.require_config(this.config.path.config, new RegExp("local\\.js"));
    if(this.config.stage){
      this.require_config(
        [this.config.path.config, 'stage', this.config.stage],
        this.config.list);
    }else{
      console.warn(
        "Notice: failed to retrieve config.stage value;"
        + "can be supplied via burden/ini.js or burden/config/local.js");
    }
    this.require_config(this.config.path.config, this.config.list);
    this.require_config(this.config.path.config, new RegExp("(.*)\\.js"));

    this.factory = {
      database: disc("class/Database"),
      server: disc("class/Server"),
      mail: disc("class/Mail"),
      space: disc("class/Space"),
      backroom: disc("class/Backroom"),
      template: disc("class/Template"),
      scenario: disc("class/Scenario")
    };

    /* Initializes shared libs.
     */
    this.database = new (this.factory.database)(this);
    this.server = new (this.factory.server)(this);
    this.mail = new (this.factory.mail)(this);
    this.space = new (this.factory.space)(this);
    this.backroom = new (this.factory.backroom)(this);
    this.template = new (this.factory.template)(this);

    // mixins
    this.mixin.Schema = disc("class/mixin/Schema");
    // CLI command arguments.
    this.retrieve_command();

    return this;
  }

  /* (
   * ) -> this
   */
  async init_lib(){
    // loads up vendors.
    [ 'puppeteer:puppeteer-core:puppeteer',
      'winston',
    ].map((a) => {
      /* Loads vendor engines with specific order.
       * foo:baz means, trying require(baz) first, and if failed, require(foo).
       * Always uses first [0] prop as the vendor-name. (In above case, foo is vendor-name.)
       */
      let s = a.split(":");
      let v = s[0];
      for(let inc of s.reverse()){
        try{
          if(!this.vendor[v]){
            this.vendor[v] = require(inc);
          }
        }catch(e){
          // @TODO Needs something?
        }
      }
    });

    /* Winston logger.
     */
    this.logger = new (disc('class/Logger'))(this, FM.ob.merge({
      path: this.config.path.log + path.sep,
    }, this.config.logger));

    await this.logger.init();

    return this;
  }

  /* () -> void
   */
  async init_status(){
  }

  /* Further overrides.
   * colloquist.open(OVERRIDE) is prior to new colloquist(OVERRIDE)
   *
   * ( Object = Config overrides.
   * ) -> this
   */
  async open(override){
    this.config = FM.ob.merge({}, this.config, override || {});
    this.validate_config();

    await this.init_lib();
    await this.init_status();

    /* Bind process events.
     */
    process.on('warning', (e) => {
      this.logger.warning(FM.vr.stringify(e));
    });

    process.on('uncaughtRejection', (reason, p) => {
      this.logger.error('CollqousitUnhandledRejection at: ' + p + ' , reason: ' + reason);
    });

    process.on('uncaughtException', (err) => {
      err.message = "COLLOQUIST UNCAUGHT EXCEPTION => " + err.message;
      this.logger.error(err);
    });

    this.__is_opened = true;

    return this;
  }

  /* Redirects args to actual actions.
   * This method requires retrieave_command call.
   *
   * ( void
   * ) -> void
   */
  async execute(override){

    if(!this.__is_opened) await this.open(override);

    switch(this.command.action){
      case "run":
        await this.recite(this.command.option.draft, this.command.option.param);
        await this.exit();
        break;
      case "tell":
        await this.tell(this.command.option.name, this.command.option.param);
        await this.exit();
        break;
      case "server":
        var o = (this.command.option.option || []).join("&");
        var d = FM.uri.unserialize(o);
        await this.server.start(
          this.command.option.name || "default",
          d || {});
        break;
      case "create":
        await this.copy_portable(process.cwd());
        break;
      case "version":
        this.logger.plain({
          level: 'info',
          message: TITLE
        });
        console.log("VERSION: " + VERSION);
        break;
      case "help":
        this.logger.plain({
          level: 'info',
          message: TITLE
        });
        console.log('no-helps');
        break;
      default:
        this.logger.warning("Unknown command: " + this.command.action);
        break;
    }

    return this;
  }

  /* ( Scenario
   * ) -> Promise -> 
   */
  async inhale(scenario){
    scenario.process_uuid = uuid();
    this.log("PROCESS UUID: " + scenario.process_uuid);

    await this.init_status(scenario);
    await this.logger.bind_scenario_dictation(scenario);
  }

  /* ( draft:string|array
   * ) -> this
   *
   */
  async recite(draft, arg, override){
    if(!this.__is_opened) await this.open(override);

    let scenario = new this.factory.scenario(this);
    await this.inhale(scenario);

    let r = {
      stack: [],
    };

    let d = draft || this.command.option.draft || false;
    try {
      let l = await scenario.load_draft(d);
      r.data = await scenario.scribe(l[0], {...l[1], ...(arg || {})});
    }catch(e) {
      this.logger.error(e);
      throw e;
    }finally{
      r.stack = scenario.reminiscence;
      let err = (scenario.reminiscence.reduce(
        (m, s) => {m = m.concat(s.error); return m;}, []));

      if(err){
        r.error = err.map((e) => {
          return {
            message: e.message || e,
            code: e.code,
          };
        });
      }
    }
    return r;
  }

  /* Calls shelf/story directly.
   *
   * ( story_uri:string
   *   arg:object Draft-scope arguments.
   * ) -> Promise -> Colloquist
   */
  async tell(def, arg){
    let s = new this.factory.scenario(this);
    await this.inhale(s);
    let t = s.take(def, arg);
    let r = await s.reflect(t);
    return r;
  }


  /* ( void
   * ) -> void | throw Error
   */
  validate_config(){
    let lack = [];
    for(let any of this.config.list){
      if(!this.config[any]){
        lack.push(any);
      }
    }
    if(lack.length){
      throw "Invalid configuration with " + lack.join(", ");
    }
  }

  /* ( array = path components
   *   array | String = Loads
   *   boolean = a switch for whole or named replacement.
   * ) -> Nothing
   */
  require_config(pp, nms){
    let base = (FM.vr.is_a(pp) ? pp : [pp]).join(path.sep);
    try{
      /* loads local files as whole override of configurations.
       * This is just for singleton configuration for each environment.
       */
      let fpath = '';
      if(FM.vr.is_s(nms)){
        this.override_config([base, nms].join(path.sep), nms);
      }else if(nms instanceof RegExp){
        let mtchs = fs.readdirSync(base);
        for(let m of mtchs){
          fpath = [base, m].join(path.sep);
          let cnm = m.replace(/\.js$/, "");
          let knm = null;

          if(!fs.lstatSync(fpath).isFile())
            continue;

          if(!m.match(nms))
            continue;

          /* if, is def configs */
          if(this.config.list.indexOf(cnm) >= 0){
            knm = cnm;
          }

          this.override_config(fpath, knm);
        }
      }
      else if(nms instanceof Array){
        for(let any of nms){
          this.require_config([base], any);
        }
      }

      return this;
    }catch(e){
      // do something
    }
  }

  /* Overrides this.config properties with require() results.
   *
   * ( path:string
   *   any:string
   * ) -> void
   */
  async override_config(path, any){
    try{
      // retrieve
      let exists = require(path);
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

  /* Retrieves CLI arguments from `npx colloquist`.
   *
   * ( void
   * ) -> void
   */
  retrieve_command(){
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
        for(let k in cmd){
          switch(k){
            case "slomo":
            case "headless":
              this.config.puppet[k] = cmd[k];
              break;
            case "gui":
              this.config.puppet['headless'] = !cmd[k];
              break;
            case "param":
              cmd[k] = cmd[k] ? FM.uri.unserialize(cmd[k].join("&")) : {};
              break;
          }
        }
        break;
      case "create":
        break;
      default:
        break;
    }

    this.command = {
      action: act,
      option: cmd,
    }

  }

  /* Copies module's local "burden" directory to CWD.
   * (Basically this CWD should be npm's project directory.)
   *
   * ( loc: string = path to copy.
   * ) -> Promise -> void
   */
  async copy_portable(loc){
    try{
      for(let p of [
        // burden
        portable,
        // commands
        ['run', 'app.js'],
        // docker related files
        'Dockerfile', '.dockerignore', 'docker-compose.yml', 'docker-compose.dev.yml', 
      ]){
        await fsx.copy(
          [this.config.base].concat(p).join(path.sep),
          [loc].concat(p).join(path.sep),
          { overwrite: false }
        );
      }
    }catch(e){
      //
    }
  }

  /* Common-exit function.
   * Closes all instances.
   *
   * ( void
   * ) -> Promise -> this
   */
  async exit(){
    if(this.space.engine){
      this.log("Closing instance...");
      await this.space.close();
    }

    this.log("<yellow>==== fin. ====</yellow>");

    /* DONT use logger after this !! */
    await this.logger.close();
    await this.database.close();

    /* Checker
    FM.async.poll((res) => {
      let a = process._getActiveHandles();
      let b = process._getActiveRequests();
      console.log("Awaiting active connections are closed...");
      console.log("Active Handles", a.length);
      console.log(a.map(aa => aa.constructor.name));
      console.log("Active Requests", b.length);
      if(a.length == 0 && b.length == 0){
        res();
      }
    });
    */

    return this;
  }

  /*====================
   * sugers.
   *====================
   */

  /* default easy logger.
   *
   * ( msg:string
   *   ?lvl:string
   *   ?depth:integer
   * ) -> Nothing
   */
  log(msg, lvl, depth){
    let p = (new Error).stack.split("\n")[(depth || 2)];
    let l = p.replace(/\s+at\s+/, "");
    this.logger.log({
      level: lvl || 'info',
      prev: l.replace(this.config.path.app, ""),
      message: msg
    });
  }

  /* Throws or returns generated Error.
   *
   * ( Error | any
   *   Function
   *   [...args]
   * ) -> Error
   */
  exception(cns, base, ...args){
    let c = (
      (cns instanceof Error) || (cns.prototype ? (cns.prototype instanceof Error) : false)
    );
    let e = c ? (new (cns)(...args)) : (new Error(...args));
    Error.captureStackTrace(e, base);
    return e;
  }

}
