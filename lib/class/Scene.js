const path = require('path');

/* Scene is a Story-vs-Space adaptor.
 * This will be instantiated via draft file and be gathered within Scenario.
 */

module.exports = class Scene {
  constructor(core, scenario, draft, param){
    //
    this.core = core;
    this.scenario = scenario;
    this.draft = draft;
    this.param = param || {};
    this.protocol = null;
    this.space = null;
    this.page = null;
    this.story = null;
    this.story_name = "";
    this.story_definition = null;
    this.arg = [];
    this.result = null;
    this.error = [];
    this.info = {
      started_at: null
    };

    // Toggles Chromium instance's auto-launch.
    this.autoload = FM.ob.thaw(draft, "autoload", false);
    // Each Scenes use named session space.
    this.session = FM.ob.thaw(draft, 'session', 'default');
    // Counts for retries when an Exception thrown in Chapter execution.
    this.retry = FM.ob.thaw(draft, 'retry', 0);
    // Default premise.
    this.premise = FM.ob.merge({}, FM.ob.thaw(draft, 'premise', {}), this.param);
    // Toggles auto-close feature on Scenario run.
    this.keep = FM.ob.thaw(draft, 'keep', false);
    // Toggles instance will be opened as Tab|Window.
    this.isolated = FM.ob.thaw(draft, 'isolated', false);

  }

  /* Scene generates general URI component from URL instance.
   * Given search-param will be treated as default premise.
   *
   * This protocol based execution can be used from core.recite too.
   */
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

    this.story_name = sn.join(path.sep);

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

    this.story_definition = require(this.core.config.path.story + path.sep + this.story_name);

    return this;
  }

  submit(){
    this.story = new this.story_definition(this.core);
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

  /* Opens Puppeteer workspace and assignes generated Page to Story.
   *
   */
  async commence(){
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

  /* Reads up a single Story.
   */
  async read(){
    this.core.debug("I'm gonna tell you a Story about... " + this.protocol.href);
    this.info.started_at = new Date().toString();
    /* handles all situations from story.
    */
    try{
      var r = await this.story.read(this.premise);
      this.result = r;
      return r;
    }catch(e){
      this.error.push(e);
      this.core.debug("Exception@Scene.read");
      throw e;
    }
  }

}
