const path = require('path');
const framework = require('express');
const session = require('express-session');

module.exports = class Server {

  constructor(core){
    this.core = core;
    this.framework = framework;
    this.session = session;
    this.engine = {};
  }

  /* Starts a single server instance as %name%.
   * Server Configuration should be in config/server and named properly.
   */
  async start(name, overrides){
    let c = this.core.config.server[name] = Object.assign(this.core.config.server[name], overrides);
    if(!c){
      throw new Error("Invalid server configuration: " + name);
    }

    let handler;
    try{
      let sp = [
        this.core.config.path.shelf,
        'server', name, 'bootstrap.js'
      ].join(path.sep);
      console.log(sp);
      handler = require(sp);
    }catch(e){
      console.log(e);
      throw new Error("Failed to load server handler definition file for " + name);
    }

    await this.prepare(name, handler, c);
  }

  /*
   */
  async prepare(name, handler, config){
    if(!(config['prepare'] instanceof (async () => {}).constructor)){
      throw new Error("config.server.prepare must be an AsyncFunction.");
    }
    this.engine[name] = this.engine[name] || {};
    this.engine[name].handler = await config.prepare(this.core, handler, config);
    this.engine[name].handler.SERVER_NAME = name;
    return this;
  }

}
