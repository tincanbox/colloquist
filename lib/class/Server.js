const path = require('path');
const framework = require('express');
const session = require('express-session');

module.exports = class Server {

  constructor(core){
    this.core = core;
    this.framework = framework;
    this.engine = {};
    this.session = session;
  }

  /* Starts a signle server instance as %name%.
   * Server Configuration should be in config/server and named properly.
   */
  async start(name, overrides){
    var c = this.core.config.server[name] = Object.assign(this.core.config.server[name], overrides);
    if(!c){
      throw new Error("Invalid server configuration: " + name);
    }

    var handler;
    try{
      handler = require([this.core.config.path.shelf, 'server', name].join(path.sep));
    }catch(e){
      throw new Error("Failed to load server handler definition file for " + name);
    }

    var e = this.engine[name] = new this.framework();
    e.use(this.framework.json());
    e.use(this.framework.urlencoded({ extended: true }));
    e.use(this.session(c.session || {}));

    await this.prepare(name, e, handler, c);
    e.listen(c.port);

    this.core.debug("Server is listening on Port:" + c.port);
  }

  /* Returns express.Router with configured.
   */
  async router(config){
    return this.framework.Router(FM.ob.merge({}, this.core.config.server.router, config || {}));
  }

  /*
   */
  async prepare(name, engine, handler, config){
    var observer;
    if(!(config['prepare'] instanceof (async () => {}).constructor)){
      throw new Error("config.server.prepare must be an AsyncFunction.");
    }
    var c = await config.prepare(this.core, engine, handler, config);
    observer = this.engine[name].handler = new handler(this.core, engine, config);
    await observer.init(c);
    return this;
  }

}
