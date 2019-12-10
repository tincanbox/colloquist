const Scene = disc("class/Scene");
const fsp = require('fs').promises;
const path = require('path');
//const cluster = require('cluster');
//const numCPUs = require('os').cpus().length;

/* Scenario
 * Story handler for each page.
 */
module.exports = class Scenario {

  constructor(core){
    this.core = core;
    this.session_container = {};
    this.passed = [];
    this.draft = {};
  }

  async init(){
    this.passed = [];
  }

  /* Collects all Scene instances and generates Story chain.
   *
   * ( Array : Story draft.
   * ) => Promise : chained story promise
   */
  async scribe(drafts, param){
    await this.init();
    this.core.debug('Scribing drafts into opened Scenario...');
    let pr = await Promise.all(this.collect(drafts, param));
    return this.story_chain(pr)
  }

  /*
   */
  async load_draft(draft){
    if(!draft){
      throw "Draft should be supplied.";
    }
    try{
      var ret;
      switch(FM.vr.type(draft)){
        case 'string':
          var prot = new URL("colloquist://" + draft);
          // Generating accessing draft-file path.
          var cmp = [];
          cmp.push(prot.host);
          cmp = cmp.concat(prot.pathname.replace(/^\//, "").split("/").filter(function(a){
            return a.length > 0;
          }));
          var dpath = [this.core.config.path.draft, cmp.join(path.sep) + '.js'].join(path.sep);
          try{
            var s = await fsp.stat(dpath);
          }catch(e){
            throw new Error("Draft file does't exist. " + dpath);
          }
          // Let's go.
          if(s){
            var d_i = await FM.async.import(dpath, this.core, prot.searchParams);
            ret = this.draft[draft] = FM.vr.is_a(d_i) ? d_i : [d_i];
          }else{
            throw new Error("Failed to find draft => " + dpath);
          }
          break;
        case 'array':
          ret = this.draft[(new Date()).getTime()] = draft;
          break;
        case 'object':
          ret = this.draft[(new Date()).getTime()] = [draft];
          break;
        default:
          throw "Invalid draft definition type.";
      }

      this.validate_draft(ret);

      return ret;

    }catch(e){
      e.message = "ReciteError: " + e.message;;
      throw e;
    }
  }

  /*
   */
  validate_draft(draft){
    if(FM.vr.type(draft) == 'array'){
      return true;
    }
    throw "Draft definition should be a valid array";
  }


  /* Recursively generates Scene instances.
   *
   * @desc Initiates Story instances.
   * ( Array : Story draft
   * ) => Array
   */
  collect(drafts, param){
    return drafts.map((s) => {
      switch(true){
        case s instanceof Array:
          return this.collect(s);
        default:
          return this.take(s);
      }
    });
  }

  /* Starts Stories vai draft definition.
   *
   * Story exception should...
   *   stop all execution
   *   or ignore error and continue
   *
   * ( Object : draft
   * ) => Promise
   */
  async story_chain(dr){
    return dr.reduce((prm, s) => {
      return prm = prm
      .catch((e) => {
        throw e;
      })
      .then(() => {
        let p;
        if(s instanceof Array){
          let has_a = s.filter((e) => {
            return (e instanceof Array);
          });
          if(has_a.length){
            p = this.story_chain(s);
            return Promise.all([p]);
          }else{
            // Semi-parallel work.
            return FM.async.queue(s.map((ss) => {
              return () => {
                return this.reflect(ss);
              };
            }), this.core.config.puppet.max_concurrent_work);
          }

        }else{
          return this.reflect(s);
        }
      });
    }, Promise.resolve());
  }

  /* Generates new Scene instance.
   *
   * ( Object : Single draft definition.
   * ) => Scene
   */
  take(draft, param){
    let r = new Scene(this.core, this, draft, param);
    // Initialize Story.
    return r;
  }

  /* Executes single Scene process.
   *
   * ( Scene
   * ) => Promise : Story.read Promises
   */
  async reflect(taken){
    if( !(taken instanceof Scene) ){
      throw new Error("Invalid story definition");
    }

    try{
      taken.init().submit();

      if(taken.autoload){
        await taken.commence();
      }

      var seq = 0;
      let c = async () => {
        var do_dictate = true;
        try{
          var r = await taken.read();

          if(taken.autoload){
            // Recovers cookies.
            if(taken.session){
              this.session(taken.session, await taken.retrieve_session());
            }
          }

          (!taken.keep) && await this.close(taken);
          (taken.done && FM.vr.is_f(taken.done)) && await taken.done.call(taken);

          return r;

        }catch(e){
          if(e instanceof ScenarioExceptionContinuable){
            /* scenario.tobecontinued -> next story in draft */
            taken.error.push(e);
            this.core.log_warn(e);
            if(taken.isolated){
              await this.close(taken);
            }
            do_dictate = false;
          }
          else{
            /* close execution if not continuable.
            */
            taken.error.push(e);

            seq++;
            if(seq <= taken.retry){
              this.core.debug("...But retrying!!! -> " + seq);
              this.core.log_error(e);
              return await c();
            }

            await this.close(taken);
            throw e;
          }

        }finally{
          var d = this.gen_dictation(taken);
          do_dictate && this.dictate(d);
          this.passed.push(d);
        }
      }
      var res = await c();
      return res;
    }catch(e){
      this.core.debug("Exception@Scenario.reflect");
      throw e;
    }
  }

  /* Closes all instances related to specified Scene.
   *
   * ( Scene
   * ) -> Promise -> void
   */
  async close(taken){
    this.core.debug("Closing space => " + taken.protocol.href);
    taken.story.page && await taken.story.page.close();
    taken.space && await this.core.space.close(taken.space);
  }

  /* Throws special Exception.
   */
  abort(msg){
    throw new ScenarioException(msg);
  }

  /* Throws special Exception.
   */
  tobecontinued(msg){
    throw new ScenarioExceptionContinuable(msg);
  }

  /* Writes down dictation info into logs.
   *
   * ( d:any
   * ) -> void
   *
   */
  dictate(d){
    this.core.debug("Scenario Dictaion");
    this.core.logger.dictate({
      level: 'trace',
      message: FM.vr.stringify(d)
    });
  }

  /* Generates dictation object from Scnene instance.
   *
   * ( Scene
   * ) -> object
   *
   */
  gen_dictation(taken){
    return {
      uri: taken.protocol.pathname,
      class: taken.story.constructor.name,
      status: (taken.error.length) ? false : true,
      premise: taken.premise,
      result: taken.result,
      error: taken.error.map((r) => JSON.parse(FM.vr.stringify(r))),
      memory: taken.story.memory,
      started_at: taken.info.started_at,
      finished_at: new Date().toString()
    }
  }

  /*
   */
  session(nm, v){
    var k = nm || 'default';
    if(!FM.ob.has(this.session_container, nm)){
      this.session_container[k] = [];
    }
    if(FM.vr.is_a(v)){
      this.session_container[k] = v;
    }
    return this.session_container[k];
  }

}

class ScenarioException extends Error {
  constructor(e){
    super(e)
  }
}
class ScenarioExceptionContinuable extends ScenarioException {
  constructor(e){
    super(e)
  }
}
