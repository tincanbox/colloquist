const Chapter = disc("class/Chapter");

/* shelf/story/*
 *
 */

module.exports = class Story {

  constructor(scene){
    this.core = scene.core;
    this.scenario = scene.scenario;
    this.scene = scene;
    this.chapter = [];
    this.preface_fullfillment = [];
    this.premise_fullfillment = [];
    this.memory = {};
    this.page = null
  }

  /* Reads up defined chapters in this Story.
   *
   * ( p:object = premises
   *   o:object = Overrides
   * ) -> Scene
   */
  async read(p, o){
    let arg = {...this._retrieve_premise(p), ...(o || {})};

    // All of Story definitions, You have to define calling chapters
    // with compose(["your", "chap", "names"]).
    if(this.chapter.length === 0){
      this.abort("Chapter can not be empty."
        + "You must register calling chapters via Story.compose() method."
        + "This registration should be done in constructor.");
    }

    // Checking preface existence and call if exists.
    if(this.preface_fullfillment.length > 0){
      this.core.logger.debug(
        "Telling preface Stories about: "
        + FM.vr.stringify(this.preface_fullfillment));
      await this.core.scenario.scribe(this.preface_fullfillment, arg);
    }

    this.core.logger.debug("Loading chapters.");
    return await this.chapter_chain(this.chapter, arg);
  }

  /* Registeres calling chapters without chapter_ prefix.
   * You can define additional arguments for each setup.
   * (Like as toggling the mode.)
   *
   * compose([
   *   "something.foo.bar"  -> chapter_something(arg, prev, "foo", "bar"),
   *   "_anything.john.doe" -> chapter__anything(arg, prev, "john", "doe"),
   *   "whatever.SUPERMODE" -> chapter_whatever(arg, prev, "SUPERMODE")
   * ])
   */
  compose(a_cname){
    return a_cname.map((e) => {
      if(e instanceof Array){
        this.chapter.push(e.map(FM.proxy(this._validate_chapter, this)));
      }else{
        let c = this._validate_chapter(e);
        if(c){
          this.chapter.push(c);
        }else{
          this.abort("Unrecognized Chapter: " + e);
        }
      }
    });
  }

  /* Registeres prerequired chapters.
   *
   * ( drafts:array
   * ) -> this
   */
  preface(drafts){
    drafts.forEach((e) => {
      if(this.preface_fullfillment.indexOf(e) < 0){
        this.preface_fullfillment.push(e);
      }
    });
    return this;
  }

  /* Registeres required premise names.
   *
   * ( list:array
   * ) -> self
   */
  premise(list){
    list.forEach((e) => {
      this.premise_fullfillment.push([e]);
    });
    return this;
  }

  /* Ensures premises.
   */
  submit(arg){
    this._fill_premise(arg);
    return this;
  }

  /* Pulls URL's contents and prepares.
   *
   * ( url:string
   *   opt:object
   * ) -> Page
   */
  async pull(url, opt){
    if(!this.page){
      await this.scene.commence();
    }

    let res = await this.page.goto(url, opt);
    await this.prepare();

    return res;
  }


  /* Prepares chapter run.
   * Chapter is designed as 1 URL access per 1 Chapter.
   * (colloquist is bit closer to Chromium automator than command handler.)
   * - $P loading
   *
   * ( url:string = URL
   *   opt:object = page.goto options.
   * ) -> Promise -> boolean
   */
  async prepare(){
    if(this.page){
      await FM.async.poll(async (rs) => {
        let r = await this.page.evaluate(() => {
          return typeof $P != 'undefined';
        });
        if(r) return rs(r);
      });
    }else{
      //
    }
    return true;
  }

  /* Just for dictation. Puts everything into memory.
   *
   * ( n:string = name of memory.
   *   v:any = value of memory.
   * ) -> void
   */
  remember(n, v){
    this.memory[n] = this.memory[n] || [];
    this.memory[n].push(v);
  }

  /* Shows colored debug message and stocks into memory.
   *
   * ( n:string
   *   v:any
   * ) -> void
   */
  monolog(n, v){
    this.core.logger.plain({
      level: 'info',
      message: 'monolog: '
        + '<yellow>' + n + '</yellow>'
        + ' -> ' + '<grey>' + FM.vr.stringify(v) + '</grey>'
    });
    this.remember(n, v);
  }

  /* Scenario Flow
   * Skips current chapter and continues to next one.
   */
  skip(e){
    throw this.core.exception(ChapterExceptionSkippable, this.skip, e);
  }

  /* Scenario Flow
   * Aborts current whole scenario flow.
   */
  abort(e, code){
    let ex = this.scenario.abort(e, code, true);
    Error.captureStackTrace(ex, this.abort);
    throw ex;
  }

  /* Scenario Flow
   * Alias for scenario.tobecontinued()
   */
  tobecontinued(e){
    let ex = this.scenario.tobecontinued(e, true);
    Error.captureStackTrace(ex, this.tobecontinued);
    throw ex;
  }

  /*
   * ( cs:array = composed chapters
   *   arg:object
   * ) => Promise
   */
  chapter_chain(cs, arg){
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
                  return await this.chapter_chain(ss, arg, prev);
                }else{
                  return await this._pull_chapter(ss, arg, prev);
                }
              }));
            default:
              return await this._pull_chapter(s, arg, prev);
          }
        });
    }, Promise.resolve());
  }

  /* Pull chapter definition and redirects previous result.
   * Also manages exception type.
   */
  async _pull_chapter(cobj, arg, prev){
    try{
      return await (cobj.callable.apply(this, [arg, prev].concat(cobj.argument)));
    }catch(e){
      if(e instanceof ChapterExceptionSkippable){
        this.core.log_warn("Skipping");
        // Returns the Exception for next chapter execution.
        return e;
      }else{
        throw e;
      }
    }
  }

  /* Chapter's Error handler.
   * This will be caught in Scenario.reflect method.
   */
  _handle_chapter_error(e){
    this.core.logger.debug("handle_chapter_error");
    throw e;
  }

  /*
   * ( String = path of chapter
   * ) => Chapter
   */
  _validate_chapter(p){
    let s = p.split("."), k = s.shift();
    return (typeof this["chapter_" + k] === "function")
      ? new Chapter({
          path: p,
          name: k,
          callable: this["chapter_" + k],
          argument: s.filter(r => (r !== ""))
        })
      : false;
  }

  /*
   */
  _fill_premise(arg){
    let o = arg || {};
    for(let k in o){
      let p = o[k];
      this.premise_fullfillment.forEach((tup) => {
        (tup[0] === k) && tup.push(p);
      });
    }
  }

  /* validateds premise arguments against defined parameters.
   */
  _retrieve_premise(p){
    this.core.logger.debug("Retrieving structured premise.");
    // Prepareing inserting premise-object.
    let o = {};
    // Retrieves supplied premise values.
    for(let tpl of this.premise_fullfillment){
      if(tpl.length === 2){
        o[tpl[0]] = tpl[1]
      }
    }
    // Additional args has HIGHER priority.
    for(let k in p){
      o[k] = p[k];
    }
    this.premise_fullfillment.map((tpl) => {
      let k = tpl[0];
      if(!Object.prototype.hasOwnProperty.call(o, k) || o[k] === undefined){
        this.abort("Ooops!! Failed to fullfill " + this.constructor.name + " prerequisites. Required premise `" + k + "` is not supplied to current instance.");
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
