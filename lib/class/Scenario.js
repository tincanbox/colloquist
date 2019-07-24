const Scene = disc("class/Scene");
//const cluster = require('cluster');
//const numCPUs = require('os').cpus().length;

/* Scenario
 * Story handler for each page.
 */
module.exports = class Scenario {

  constructor(core){
    this.core = core;
    this.session_container = {};
  }

  /* scribe
   * @desc
   * ( Array : Story draft.
   * ) => Promise : chained story promise
   */
  async scribe(drafts){
    this.core.debug('Scribing drafts');
    let pr = await Promise.all(this.collect(drafts));
    return this.story_chain(pr)
  }

  /* collect
   * @desc Initiates Story instances.
   * ( Array : Story draft
   * ) => Array
   */
  collect(drafts){
    return drafts.map((s) => {
      switch(true){
        case s instanceof Array:
          return this.collect(s);
        default:
          return this.take(s);
      }
    });
  }

  /* story_chain
   * @desc Starts Stories vai draft definition.
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
      .then((res) => {
        let p;
        switch(true){
          /* if all-elem is not an array,
           * runs story recursively.
           */
          case s instanceof Array:
            let has_a = s.filter((e) => {
              return (e instanceof Array);
            });
            if(has_a.length){
              p = this.story_chain(s);
              return Promise.all([p]);
            }else{
              // Semi-parallel work.
              return FM.async.queue(s.map((ss) => {
                return (e) => {
                  return this.reflect(ss);
                };
              }), this.core.config.puppet.max_concurrent_work);
            }
            break;
          default:
            return this.reflect(s);
         }
      });
    }, Promise.resolve());
  }

  /* take
   * ( Object : Single draft definition.
   * ) => Scene
   */
  take(draft){
    let r = new Scene(this.core, this, draft);
    // Initialize Story.
    return r;
  }

  /* reflect
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
        await taken.open();
      }else{
      }

      var seq = 0;
      let c = async () => {
        var do_dictate = true;
        try{
          var r = await taken.read();

          // Recovers cookies.
          if(taken.session){
            this.session(taken.session, await taken.retrieve_session());
          }

          (!taken.keep) && await this.close(taken);
          (taken.done && FM.vr.is_f(taken.done)) && await taken.done.call(taken);

          return r;

        }catch(e){
          /* scenario.tobecontinued -> next story in draft */
          if(e instanceof ScenarioExceptionContinuable){
            taken.story.error.push(e.message);
            this.core.log_warn(e);
            if(taken.isolated){
              await this.close(taken);
            }
            do_dictate = false;
          }else{
            /* close execution if not continuable.
            */
            taken.story.error.push(e.message);
            this.core.debug("This is not continuable error.");
            this.core.log_error(e);
            seq++;
            if(seq <= taken.retry){
              this.core.debug("...But retrying!!! -> " + seq);
              return await c();
            }

            await this.core.send_report('default/scenario_error', {
              subject: 'Alert: Unrecoverable Scenario Exception',
              data: {
                error: e
              }
            });

            this.core.debug("Theres no remaining retry.");
            await this.close(taken);
            throw e;
          }

        }finally{
          do_dictate && this.dictate(taken);
        }
      }
      var res = await c();
      return res;
    }catch(e){
      this.core.debug("reflect global error");
      this.core.log_error(e);
      throw e;
    }
  }

  async close(taken){
    this.core.debug("Closing space => " + taken.protocol.href);
    taken.story.page && await taken.story.page.close();
    taken.space && await this.core.space.close(taken.space);
  }

  abort(msg){
    throw new ScenarioException(msg);
  }

  tobecontinued(msg){
    throw new ScenarioExceptionContinuable(msg);
  }

  dictate(taken){
    this.core.logger.dictate({
      level: 'trace',
      message: JSON.stringify({
        uri: taken.protocol.pathname,
        class: taken.story.constructor.name,
        status: (taken.story.error.length) ? false : true,
        premise: taken.premise,
        error: taken.story.error,
        memory: taken.story.memory,
        started_at: taken.info.started_at,
        finished_at: new Date()
      })
    });
  }

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
class ScenarioExceptionSkippable extends ScenarioException {
  constructor(e){
    super(e)
  }
}
class ScenarioExceptionContinuable extends ScenarioException {
  constructor(e){
    super(e)
  }
}