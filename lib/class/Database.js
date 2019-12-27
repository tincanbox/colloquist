const fs = require('fs').promises;
const path = require('path');

module.exports = class Database {

  constructor(core){
    this.core = core;
    this.engine = {};
    this.__conn = {};
    this.__bucket = {};

    this.init_config();
  }

  /* ( name:string
   *   override:object
   * ) -> Promise -> Conenction
   */
  async connect(name, override){
    var conf = this.core.config.database[name];

    if(!conf){
      throw new Error("DatabaseError: " + name + " is not defined as a config.");
    }

    if(override){
      conf = FM.ob.merge({}, conf, override);
    }

    if(!this.engine[conf.engine]){
      this.engine[conf.engine] = require(conf.engine);
    }

    if(this.__conn[name]){
      //
    }else{
      conf.uri = (conf.protocol || conf.engine) + "://"
        + (conf.host || "") + (conf.port ? ":" + conf.port : "")
        + "/" + (conf.database || "") ;

      var con;
      if(conf.connect){
        con = await conf.connect(this, conf);
      }else{
        con = this.default_connection(conf);
      }

      this.__conn[name] = {
        name: name,
        module: conf.engine,
        engine: this.engine[conf.engine],
        handler: con,
        bucket: {}
      };

      conf.factory.init
        ? (await conf.factory.init(this, this.__conn[name], conf))
        : (await this.factory(this.__conn[name], conf));

    }
    return this.__conn[name];
  }

  /* ORM Model generator
   * ( name:string
   *   conf:object
   * ) -> Promise -> ORM Dictionary.
   */
  async factory(conn, conf){
    /* Write your own Schema designs here.
    */
    var name = conn.name;
    var ps = this.core.config.path.schema;
    var l = await fs.readdir(ps + path.sep + name);
    if(l){
      for(var f of l){
        let spf, ext, mnm, fnc, sch;
        spf = f.split(".");
        ext = spf.pop();
        if(ext != "js") continue;
        mnm = spf.join(".");
        fnc = require(ps + path.sep + name + path.sep + f);
        sch = await fnc(mnm, conn, this.default_factory_option(mnm, conn, conf));
        conn.bucket[mnm] = sch;
      }
    }
    return this;
  }

  init_config(){
    var cn = this.core.config.database;
    var def = {
      protocol: "",
      engine: "",
      host: "",
      port: "",
      database: "",
      user: "",
      password: "",
      handler: {},
      factory: {},
    };

    for(var ck in cn){
      var config = cn[ck];
      config.name = ck;
      for(var dk in def){
        var v = def[dk];
        if(!FM.ob.has(config, dk)){
          config[dk] = (typeof v == 'object') ? {} : v;
        }
      }
    }

    return cn;
  }

  /*
   */
  async close(){
    for(var k in this.__conn){
      var con = this.__conn[k];
      switch(con.module){
        case "mongoose":
          await con.handler.close();
          break;
        case "sequelize":
          await con.handler.close();
          break;
      }
    }
  }

  /*
   */
  default_connection(config){
    let opt = config.handler.option || {};
    switch(config.engine){
      case "sequelize":
        return new this.engine.sequelize(
          config.database || "",
          config.user || "",
          config.password || "",
          opt
        );
      case "mongoose":
        if(config.user){
          opt.user = config.user;
        }
        if(config.password){
          opt.pass = config.password;
        }
        return this.engine.mongoose.createConnection(config.uri, opt);
      default:
        throw new Error("DatabaseError: " + config.engine + " is not supported.");
    }
  }

  default_factory_option(model_name, conn, config){
    switch(config.engine){
      case "sequelize":
        config.factory.option = config.factory.option || {};
        config.factory.option.sequelize = conn.handler;
        config.factory.option.modelName = model_name;
        break;
      case "mongoose":
        break;
      default:
        throw new Error("DatabaseError: " + config.engine + " is not supported.");
    }

    return config.factory.option;
  }


}
