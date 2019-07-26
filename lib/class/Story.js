const Chapter = disc("class/Chapter");

module.exports = class Story {

  constructor(core){
    this.core = core;
    this.scenario = null;
    this.scene = null;
    this.reminiscene = [];
    this.chapter = [];
    this.premise_fullfillment = [];
    this.error = [];
    this.memory = {};
    this.page = null
  }

  submit(arg){
    this.fill_premise(arg);
  }

  async read(p, prev){
    let param = this.retrieve_premise(p);

    if(this.chapter.length == 0){
      this.abort("Chapter can not be empty!!");
    }

    let last;
    if(this.reminiscene.length > 0){
      this.core.debug("Ack! I have to tell you important Stories first... About: " + this.reminiscene.join(", "));
      last = await this.core.sequence(this.reminiscene);
    }

    this.core.debug("Loading chapters.");
    return this.chapter_chain(this.chapter, param);
  }

  /*
   */
  handle_chapter_error(e){
    this.core.debug("handle_chapter_error");
    this.core.log_error(e);
    throw e;
  }

  /*
   * (
   * ) => Promise
   */
  chapter_chain(cs, param){
    return cs.reduce((prm, s) => {
      return prm = prm
        .catch(e => console.log)
        .then(async (prev) => {
          /* [
           *   "chapter_01",
           *   ["chapter_02_1", "chapter_02_02"]
           * ]
           */
          switch(true){
            case s instanceof Array:
              return Promise.all(s.map(async (ss) => {
                if(ss instanceof Array){
                  return await this.chapter_chain(ss, param, prev);
                }else{
                  return await this.pull_chapter(ss, param, prev);
                }
              }));
            default:
              return await this.pull_chapter(s, param, prev);
          }
        });
    }, Promise.resolve());
  }

  async pull_chapter(cobj, param, prev){
    if(!(cobj.callable instanceof ((async () => {}).constructor))){
      this.core.error("Each chapter should be an AsyncFunction");
    }

    try{
      let r = await cobj.callable.apply(this, [param, prev].concat(cobj.param));
      return r;
    }catch(e){
      this.core.debug("story pull_chapter error");
      this.core.log_error(e);
      throw e;
    }
  }

  compose(a_cname){
    return a_cname.map((e) => {
      if(e instanceof Array){
        this.chapter.push(e.map(FM.proxy(this.is_valid_chapter, this)));
      }else{
        var c = this.is_valid_chapter(e);
        if(c){
          this.chapter.push(c);
        }else{
          this.abort("Unrecognized Chapter: " + e);
        }
      }
    });
  }

  remini(story){
    story.map((e) => {
      if(this.reminiscene.indexOf(e) < 0){
        this.reminiscene.push(e);
      }
    });
  }

  /*
   * ( String = path of chapter
   * ) => Chapter
   */
  is_valid_chapter(p){
    var s = p.split(".");
    var k = s.shift();
    return (typeof this["chapter_" + k] === "function")
      ? new Chapter({
          path: p,
          name: k,
          callable: this["chapter_" + k],
          param: s
        })
      : false;
  }

  premise(list){
    list.map((e) => {
      this.premise_fullfillment.push([e]);
    });
  }

  fill_premise(list){
    this.premise_fullfillment.map((tpl, i) => {
      if(list[i]){
        tpl.push(list[i]);
      }
    });
  }

  retrieve_premise(p){
    this.core.debug("Retrieving structured premise.");
    let o = {};
    this.premise_fullfillment.map((tpl) => {
      o[tpl[0]] = tpl[1]
    });
    // Additional param has HIGHER priority.
    for(var k in p){
      o[k] = p[k];
    }
    this.premise_fullfillment.map((tpl) => {
      let k = tpl[0];
      if(!o.hasOwnProperty(k) || o[k] === undefined){
        this.abort("Ooops!! Failed to fullfill " + this.constructor.name + " prerequisites. Required premise `" + k + "` is not supplied to current instance.");
        return;
      }
    });
    return o;
  }

  async prepare(){
    var ready = false;
    await FM.async.sleep(100000);
    await FM.async.poll(async (rs) => {
      var rdy = await this.page.evaluate(() => {
        return typeof $P != 'undefined';
      });
      console.log(rdy);
      FM.async.sleep(10000);
      if(rdy){
        return rs(rdy);
      }
    });
    return ready;
  }

  remember(n, v){
    this.memory[n] = this.memory[n] || [];
    this.memory[n].push(v);
  }

  /* Skips current chapter and continues to next one.
   */
  skip(){
  }

  tobecontinued(a){
    return this.scenario.tobecontinued(a);
  }

}

