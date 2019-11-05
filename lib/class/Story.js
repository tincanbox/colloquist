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
    this._fill_premise(arg);
  }

  async read(p, o){
    let param = FM.ob.merge(this._retrieve_premise(p), o || {});

    if(this.chapter.length == 0){
      this.abort("Chapter can not be empty!!");
    }

    if(this.reminiscene.length > 0){
      this.core.debug("Ack! I have to tell you important Stories first... About: " + this.reminiscene.join(", "));
      await this.core.sequence(this.reminiscene);
    }

    this.core.debug("Loading chapters.");
    return this.chapter_chain(this.chapter, param);
  }

  compose(a_cname){
    return a_cname.map((e) => {
      if(e instanceof Array){
        this.chapter.push(e.map(FM.proxy(this._is_valid_chapter, this)));
      }else{
        var c = this._is_valid_chapter(e);
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

  premise(list){
    list.map((e) => {
      this.premise_fullfillment.push([e]);
    });
  }

  /* wip
   */
  async prepare(){
    var ready = false;
    await FM.async.poll(async (rs) => {
      var rdy = await this.page.evaluate(() => {
        return typeof $P != 'undefined';
      });
      if(rdy){
        this.core.debug("$P loaded.");
        return rs(rdy);
      }
    });
    return ready;
  }

  /* Just for dictation.
   */
  remember(n, v){
    this.memory[n] = this.memory[n] || [];
    this.memory[n].push(v);
  }

  monolog(n, v){
    this.core.logger.log({
      level: 'debug',
      message: '<yellow>' + this.scene.protocol.pathname + '</yellow> : ' + n
    });
    console.log(v);
    this.remember(n, v);
  }

  /* Scenario Flow
   */
  abort(e){
    return this.scenario.abort(e);
  }

  /* Scenario Flow
   * Skips current chapter and continues to next one.
   */
  skip(e){
    throw new ChapterExceptionSkippable(e);
  }

  /* Scenario Flow
   */
  tobecontinued(a){
    return this.scenario.tobecontinued(a);
  }

  /*
   * (
   * ) => Promise
   */
  chapter_chain(cs, param){
    return cs.reduce((prm, s) => {
      return prm = prm
        .catch(FM.proxy(this._handle_chapter_error, this))
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
                  return await this._pull_chapter(ss, param, prev);
                }
              }));
            default:
              return await this._pull_chapter(s, param, prev);
          }
        });
    }, Promise.resolve());
  }

  /* Pull chapter definition and redirects previous result.
   * Also manages exception type.
   */
  async _pull_chapter(cobj, param, prev){
    try{
      var r;
      if(!(cobj.callable instanceof ((async () => {}).constructor))){
        r = cobj.callable.apply(this, [param, prev].concat(cobj.param));
      }else{
        r = await cobj.callable.apply(this, [param, prev].concat(cobj.param));
      }
      return r;
    }catch(e){
      if(e instanceof ChapterExceptionSkippable){
        this.core.log_warn("Skipping");
        return e;
      }
      else{
        this.core.debug("Story._pull_chapter error");
        throw e;
      }
    }
  }

  /*
   */
  _handle_chapter_error(e){
    this.core.debug("handle_chapter_error");
    throw e;
  }

  /*
   * ( String = path of chapter
   * ) => Chapter
   */
  _is_valid_chapter(p){
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

  _fill_premise(list){
    this.premise_fullfillment.map((tpl, i) => {
      if(list[i]){
        tpl.push(list[i]);
      }
    });
  }

  /* validateds premise params.
   */
  _retrieve_premise(p){
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
      if(!Object.prototype.hasOwnProperty.call(o, k) || o[k] === undefined){
        this.abort("Ooops!! Failed to fullfill " + this.constructor.name + " prerequisites. Required premise `" + k + "` is not supplied to current instance.");
        return;
      }
    });
    return o;
  }

}

class ChapterExceptionSkippable extends Error {
  constructor(e){
    super(e)
  }
}
