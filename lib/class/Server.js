const koa = require('koa');
const koa_router = require('@koa/router');

module.exports = class Server {

  constructor(core){
    this.core = core;
    this.engine = new koa();
    this.router = new koa_router();
    this.context = {};
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
