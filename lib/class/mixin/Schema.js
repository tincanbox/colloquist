module.exports = class Schema {

  /*
   */
  constructor(name, conn, option){
    /* {
     * engine:
     * handler:
     * bucket:
     * }
     */
    let opt = option || {};
    this.db = conn;
    this.name = name;
    this.schema = null;
    this.structure = opt.structure || {};

    this.__structure_translation = {};
    switch(this.db.module){
      case "mongoose":
        this.__structure_translation = {
          "string":     [ String,      (v) => FM.vr.to_s(v) ],
          "text":       [ String,      (v) => FM.vr.to_s(v) ],
          "object":     [ Object,      (v) => v ],
          "integer":    [ Number,      (v) => v ],
          "datetime":   [ Date,        (v) => v ],
        };
        break;
      case "sequelize":
        var tps = this.db.engine.DataTypes;
        this.__structure_translation = {
          "string":     [ tps.STRING,  (v) => FM.vr.to_s(v) ],
          "text":       [ tps.TEXT,    (v) => FM.vr.to_s(v) ],
          "object":     [ tps.TEXT,    (v) => FM.vr.stringify(v) ],
          "integer":    [ tps.INTEGER, (v) => v ],
          "datetime":   [ tps.DATE,    (v) => v ],
        };
        break;
    }

  }

  /*
   */
  format(data){
    var r = {};
    for(var k in data){
      if(this.structure[k]){
        var st = this.structure[k];
        var tp = this.__structure_translation[st.type];
        r[k] = tp[1](data[k]);
      }
    }
    return r;
  }

  /*
   */
  async define(data, option){
    var ins;
    var opt = option || {};

    this.structure = data;

    switch(this.db.module){
      case "mongoose":
        ins = this.db.handler.model(
          this.name,
          new this.db.engine.Schema(
            this.translate_structure(this.structure),
            FM.ob.merge({collection: this.name}, opt || {})
          )
        );
        break;
      case "sequelize":
        var m = class extends this.db.engine.Model {};
        opt.sequelize = this.db.handler;
        opt.modelName = this.name;
        opt.freezeTableName = true;
        opt.logging = false;
        opt.timestamps = false;
        opt.version = false;
        opt.paranoid = false;
        ins = m.init(this.translate_structure(this.structure), opt || {});
        await ins.sync();
        break;
      default:
        throw new Error("Invalid module type.");
    }

    /* You can use module-original instance.
     */
    this.schema = ins;

    return this;
  }

  /*
   */
  translate_structure(data){
    let r = {};
    for(var k in data){
      r[k] = r[k] || {};
      r[k].type = this.convert_field_type(data[k].type);
    }
    return r;
  }

  /*
   */
  convert_field_type(field){
    try{
      let ts = this.__structure_translation[field];
      if(ts[0]){
        return ts[0];
      }
    }catch(e){
      //
      throw "Invalid Field Type: " + field;
    }
  }


  /*====================
   * C.R.U.D.
   *====================
   */

  async create(data){
    var inserting = this.format(data);
    switch(this.db.module){
      case "mongoose":
        var ins = new this.schema(inserting);
        await ins.save();
        break;
      case "sequelize":
        await this.schema.create(inserting);
        break;
    }
    return this;
  }

  async read(query){
    return await this.fetch.apply(this, arguments);
  }

  async fetch(query){
    switch(this.db.module){
      case "mongoose":
        break;
      case "sequelize":
        break;
    }
  }

  async update(data){
    switch(this.db.module){
      case "mongoose":
        break;
      case "sequelize":
        break;
    }
  }

  async delete(query){
    switch(this.db.module){
      case "mongoose":
        break;
      case "sequelize":
        break;
    }
  }

}
