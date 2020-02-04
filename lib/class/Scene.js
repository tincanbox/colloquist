const path = require('path');

/* Scene is a Story-vs-Space adaptor.
 * This will be instantiated via draft file and be gathered within Scenario.
 */

module.exports = class Scene {
  constructor(scenario, draft, arg){
    // Reverse reference.
    this.core = scenario.core;
    this.scenario = scenario;

    this.draft = draft;
    this.protocol = null;
    this.page = null;
    this.story = null;
    this.story_component = [];
    this.story_definition = null;
    this.argument = arg || {};
    this.result = null;
    this.error = [];
    this.info = {
      started_at: null
    };

    // Counts for retries when an Exception thrown in Chapter execution.
    this.retry = FM.ob.thaw(draft, 'retry', 0);
    // Default premise.
    this.premise = FM.ob.thaw(draft, 'premise', {});

    /* Space related configs.
     */
    this.space_id = null;
    // Toggles Chromium instance's auto-launch.
    this.space_autoload = FM.ob.thaw(draft, 'space.autoload', false);
    // Each Scenes use named session space.
    this.space_session = FM.ob.thaw(draft, 'space.session', 'default');
    // Toggles auto-close feature on Scenario run.
    this.space_keep = FM.ob.thaw(draft, 'space.keep', false);
    // Toggles instance will be opened as Tab|Window.
    this.space_isolated = FM.ob.thaw(draft, 'space.isolated', false);
  }

  /* Scene generates general URI component from URL instance.
   * Given search-query-string will be treated as default premise.
   *
   * This protocol based execution can be used from core.recite too.
   */
  init(){

    this.protocol = this.generate_protocol(this.draft);

    let p = this.protocol.pathname.replace(/^\/\//, "");
    let cmp = p.split(/\.|\//);
    let pg = [];
    let sn = [];

    /* story://foo@baz.bar@doe.lorem/ipsam?some=1&thing=3
     * -> cmp=[foo@baz, bar@doe, lorem, ipsam]
     * -> pg=baz-doe, sn=[foo,bar,lorem,ipsam]
     */
    cmp.map((p) => {
      let pp = p.split("@");
      let l = (pp.length > 1) ? pp.pop() : false;
      sn = sn.concat(pp);
      l && pg.push(l);
    });

    this.story_component = sn;
    this.page = pg.join("-");

    this.premise = this.protocol.search
      ? FM.uri.unserialize(this.protocol.search.replace(/^\?/, ""))
      : {};

    if(FM.vr.is_object(this.draft)){
      if(this.draft.retry){
        this.retry = parseInt(this.draft.retry);
      }
    }

    this.story_definition = require(
      this.core.config.path.story + path.sep +
      this.story_component.join(path.sep)
    );

    return this;
  }

  /* Chaining submition Scene -> Story
   */
  submit(){
    this.story = new this.story_definition(this);
    this.story.submit(this.argument);
    return this;
  }

  /* Generates URL instance as a protocol.
   * This will be convenience when we need HTTP server as Story trigger.
   *
   * ( Object | String : from draft.
   * ) -> URL
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
    let pf = "scene";
    let rg = new RegExp("^" + pf + ":");
    switch(true){
      case typeof draft == "string":
        if(draft.match(rg)){
          id = draft;
        }else{
          id = pf + ":" + draft;
        }
        break;
      case draft === Object(draft):
        id = pf + ":" + draft.story
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
   * ( void
   * ) -> this
   */
  async commence(){
    // Set very default of Story space.
    if(this.space_isolated){
      this.space_id = (new Date()).getTime();
      this.story.page = await this.core.space.flip(this.space_id);
    }else{
      this.story.page = await this.core.space.flip();
    }

    if(this.space_session){
      // Re-apply cookies.
      for(var ck of this.scenario.session(this.space_session)){
        await this.story.page.setCookie(ck);
      }
    }

    return this;
  }

  /* async (
   *   void
   * ) -> array
   */
  async retrieve_session(){
    let c = await this.story.page.cookies();
    return c;
  }

  /* Reads up a single Story.
   *
   * (
   * ) -> any = result of Story.read call.
   */
  async read(){
    this.core.debug("I'm gonna tell you a Story about... " + this.protocol.href);
    this.info.started_at = new Date();
    this.core.debug("started_at: " + this.info.started_at.toString());
    /* handles all situations from story.  */
    this.result = await this.story.read(this.premise, this.argument);
    return this.result;
  }

}
