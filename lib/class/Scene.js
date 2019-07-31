const path = require('path');

module.exports = class Scene {
  constructor(core, scenario, draft, param){
    //
    this.core = core;
    this.scenario = scenario;
    this.draft = draft;
    this.param = param;
    this.protocol = null;
    this.space = null;
    this.page = null;
    this.story = null;
    this._story = null;
    this.arg = [];
    this.info = {
      started_at: null
    };

    //
    this.autoload = FM.ob.thaw(draft, "autoload", true);
    // Each Scenes use named session space.
    this.session = FM.ob.thaw(draft, 'session', 'default');
    this.retry = FM.ob.thaw(draft, 'retry', 0);
    this.premise = FM.ob.thaw(draft, 'premise', {});
    this.keep = FM.ob.thaw(draft, 'keep', false);
    this.newtab = FM.ob.thaw(draft, 'newtab', false);
    this.isolated = FM.ob.thaw(draft, 'isolated', false);

  }

  init(){
    var draft = this.draft;

    this.protocol = this.generate_protocol(draft);

    let p = this.protocol.pathname.replace(/^\/\//, "");
    let cmp = p.split(/\.|\//);
    let pg = [];
    let sn = [];

    cmp.map((p) => {
      let pp = p.split("@");
      let l = (pp.length > 1) ? pp.pop() : false;
      sn = sn.concat(pp);
      l && pg.push(l);
    });

    let sname = sn.shift();

    this.page = pg.join("-");
    this.arg = sn;

    this.premise = this.protocol.search
      ? FM.uri.unserialize(this.protocol.search.replace(/^\?/, ""))
      : {};

    if(FM.vr.is_object(draft)){
      if(draft.retry){
        this.retry = parseInt(draft.retry);
      }
      if(draft.premise){
        FM.ob.merge(this.premise, draft.premsie);
      }
    }

    this._story = require(this.core.config.path.shelf + path.sep + sname);

    return this;
  }

  submit(){
    this.story = new this._story(this.core);
    this.story.scenario = this.scenario;
    this.story.scene = this;
    this.story.submit(this.arg);
    return this;
  }

  /* Generates URL instance as a protocol.
   * This will be convenience when we need HTTP server as Story trigger.
   * ( Object | String : from draft.
   * ) => URL
   */
  generate_protocol(draft){
    /*
     * {
     *   story: "",
     *   page: "",
     *   premise: {
     *   }
     * }
     */
    let id = "";
    switch(true){
      case typeof draft == "string":
        if(draft.match(/^story:/)){
          id = draft;
        }else{
          id = "story:" + draft;
        }
        break;
      case draft === Object(draft):
        id = "story:" + draft.story
          + (draft.page && draft.page.length > 0
            ? "@" + draft.page
            : ""
            )
          + (draft.premise != undefined
            ? "?" + ((o) => {
                return FM.ob.serialize(o).map((tpl) => {
                  return tpl[0] + "=" + encodeURIComponent(tpl[1]);
                }).join("&");
              })(draft.premise)
            : "");
        break;
    }

    return new URL(id);
  }

  async open(){
    var taken = this;
    // Set very default of Story space.
    if(taken.isolated){
      taken.space = taken.protocol.href;
      var cnt = await this.core.space.create(taken.space);
      taken.story.page = await this.core.space.insert(cnt);
    }else{
      taken.story.page = await this.core.space.flip();
    }

    if(taken.session){
      // Re-apply cookies.
      for(var ck of this.scenario.session(this.session)){
        await taken.story.page.setCookie(ck);
      }
    }
    return this;
  }

  /* async (
   *   void
   * ) => Array
   */
  async retrieve_session(){
    return this.story.page.cookies();
  }

  async read(){
    this.core.debug("I'm gonna tell you a Story about... " + this.protocol.href);
    this.info.started_at = new Date();
    /* handles all situations from story.
    */
    try{
      return await this.story.read(this.premise);
    }catch(e){
      this.core.debug("scene read error");
      this.core.log_error(e);
      throw e;
    }
  }

}
