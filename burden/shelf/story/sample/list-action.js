const Story = disc("class/Story");
const fsp = require('fs').promises;
const path = require('path');

module.exports = class extends Story {

  constructor(core){
    super(core);

    this.preface([
    ]);

    this.premise([
    ]);

    this.compose([
      "hub"
    ]);

  }


  /* play your way with sample chapter.
   */
  async chapter_hub(param, prev){

    let base = this.core.config.path.story;
    let result = [];

    let dig = async (ret, pt) => {
      let entry_list = await fsp.readdir(pt);
      for(let ent of entry_list){
        let se = path.resolve(pt + path.sep + ent);
        let st = await fsp.stat(se);
        let fn = se.replace(base, "");
        if(st.isDirectory()){
          let sd = await dig(ret, se);
          ret.concat(sd);
        }else{
          let rg = /\.js$/;
          if(ent.match(rg)){
            ret.push(fn.replace(rg, ""));
          }
        }
      }
    }

    await dig(result, base);

    return result;
  }

}
