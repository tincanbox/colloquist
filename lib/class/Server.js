const framework = require('express');

module.exports = class Server {

  constructor(core){
    this.core = core;
    this.framework = framework;
    this.engine = new framework();
    this.router = framework.Router();
    this.context = {};

    this.engine.use(framework.json());
    this.engine.use(framework.urlencoded({ extended: true }));

  }

  /*
   */
  async start(name){
    var c = this.core.config.server[name];
    if(!c){
      throw new Error("Invalid server configuration: " + name);
    }
    await this.prepare(c);
    this.engine.listen(c.port);
    this.core.debug("Server is listening on Port:" + c.port);
  }

  /*
   */
  async prepare(config){
    await config.prepare(this);
    return this;
  }

}
