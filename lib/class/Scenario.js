const Scene = disc("class/Scene");
const fsp = require('fs').promises;
const path = require('path');
const { ScenarioException, ScenarioExceptionContinuable } = require('./exception/ScenarioException');
//const cluster = require('cluster');
//const numCPUs = require('os').cpus().length;

/* Scenario
 * Story handler for each page.
 */
module.exports = class Scenario {

  constructor(core){
    this.core = core;
    this.session_container = {};
    this.reminiscence = [];
    this.draft = {};
  }

  async reset(){
    this.reminiscence = [];
  }

  /* Collects all Scene instances and generates Story chain.
   *
   * ( Array : Story draft.
   * ) => Promise : chained story promise
   */
  async scribe(drafts, arg){
    await this.reset();
    this.core.logger.debug('Scribing drafts into opened Scenario...');
    let pr = await Promise.all(this.collect(drafts, arg));
    return (await this.story_chain(pr));
  }

  /* Loads Draft definition and generates formatted protocol.
   * ( draft:string|array|object
   * ) -> draft
   */
  async load_draft(draft){
    if(!draft){
      this.abort("Draft should be supplied.");
    }

    let ret, lod, arg = {};
    switch(FM.vr.type(draft)){
      // If String is given, generates the loader protocol.
      case 'string':
        lod = await this.generate_draft_protocol(draft);
        arg = lod.argument;
        ret = this.draft[draft] = FM.vr.is_a(lod.draft) ? lod.draft : [lod.draft];
        break;
      case 'array':
        ret = this.draft[(new Date()).getTime()] = draft;
        break;
      case 'object':
        ret = this.draft[(new Date()).getTime()] = [draft];
        break;
      default:
        this.abort("Invalid draft definition type.");
    }

    this.validate_draft(ret);

    return [ret, arg];
  }

  /*
   */
  async generate_draft_protocol(draft_string){
    let protocol = null;
    let argument = {};
    let file = "";

    // Generates dummy URL protocol to parse draft_string.
    protocol = new URL("draft://" + draft_string);

    protocol.searchParams.forEach((v, k) => {
      argument[k] = v;
    });

    let cmp = [];
    // Generating accessing draft-file path.
    cmp.push(protocol.host);
    cmp = cmp.concat(protocol.pathname.replace(/^\//, "").split("/").filter(function(a){
      return a.length > 0;
    }));
    file = [this.core.config.path.draft, cmp.join(path.sep) + '.js'].join(path.sep);

    let s;
    try{
      s = await fsp.stat(file);
    }catch(e){
      this.abort("Draft file does't exist. => " + file.replace(this.core.config.path.app, ""));
    }

    // Let's go.
    if(s){
      return {
        protocol: protocol,
        argument: argument,
        path: file,
        draft: await FM.async.import(file, this.core, argument)
      }
    }else{
      this.abort("Failed to find draft => " + file);
    }
  }

  /*
   */
  validate_draft(draft){
    if(FM.vr.type(draft) === 'array'){
      return true;
    }
    this.abort("Draft definition should be a valid array");
  }


  /* Recursively generates Scene instances.
   *
   * @desc Initiates Story instances.
   * ( Array : Story draft
   * ) => Array
   */
  collect(drafts, arg){
    return drafts.map((s) => {
      return (s instanceof Array) ? this.collect(s, arg) : this.take(s, arg);
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
      prm = prm
      .catch((e) => {
        this.abort(e);
      })
      .then(() => {
        let p;
        if(s instanceof Array){
          // Calls recursively.
          let has_a = s.filter((e) => {
            return (e instanceof Array);
          });
          if(has_a.length){
            p = this.story_chain(s);
            return Promise.all([p]);
          }else{
            // Semi-parallel-async work.
            return FM.async.queue(s.map((ss) => {
              return () => {
                return this.reflect(ss);
              };
            }), this.core.config.puppet.max_concurrent_work || 4);
          }

        }else{
          return this.reflect(s);
        }
      });
      return prm;
    }, Promise.resolve());
  }

  /* Generates new Scene instance.
   *
   * ( Object : Single draft definition.
   * ) => Scene
   */
  take(draft, arg){
    // Initialize Story.
    return new Scene(this, draft, arg);
  }

  /* Executes single Scene process.
   *
   * ( Scene
   * ) => Promise : Story.read Promises
   */
  async reflect(taken){
    if( !(taken instanceof Scene) ){
      this.abort("Invalid story definition");
    }

    try{
      taken.init().submit();

      if(taken.space_autoload){
        await taken.commence();
      }

      let seq = 0;
      let dict = this.gen_dictation(taken);

      let main = async () => {
        //
        let r = await taken.read();
        //
        if(taken.space_autoload){
          // Recovers cookies.
          if(taken.space_session){
            this.session(taken.space_session, await taken.retrieve_session());
          }
        }
        //
        (taken.done && FM.vr.is_f(taken.done)) && await taken.done.call(taken);

        return r;
      };

      let proc = async () => {
        try{
          seq++;
          try{
            return await main();
          }catch(e){
            if(e instanceof ScenarioExceptionContinuable){
              /* scenario.tobecontinued -> next story in draft */
              //taken.error.push(e);
              this.core.log_warn(e);
              if(taken.space_isolated){
                await this.close(taken);
              }
            }
            else{
              /* close execution if not continuable.
              */
              let de = this.abort(e, 100, true);
              Error.captureStackTrace(de, this.reflect);
              taken.error.push(de);
              console.error(de);
              throw de;
            }
          }
        }finally{
          this.gen_dictation(taken, dict);
          this.dictate(dict);
          if(!this.reminiscence.includes(dict)){
            this.reminiscence.push(dict);
          }
          (!taken.space_keep) && await this.close(taken);
        }
      }

      let retry = async (fn) => {
        while(fn){
          try{
            return await fn();
          }catch(e){
            if(seq && seq <= taken.retry){
              taken.retried = seq;
              this.core.logger.debug("...retrying -> " + seq);
            }else{
              // GAMEOVER.
              throw e;
            }
          }finally{
            //
          }
        }
      }

      return await retry(proc);
    }catch(e){
      this.core.logger.debug("Exception@Scenario.reflect");
      this.core.logger.error(e);
      throw e;
    }finally{
      //
    }
  }

  /* Closes all Puppeteer instances related to specified Scene.
   *
   * ( Scene
   * ) -> Promise -> void
   */
  async close(taken){
    taken.story.page && await taken.story.page.close();
    taken.space_id && await this.core.space.close(taken.space_id);
  }

  /* Throws special Exception.
   */
  abort(msg, code, ret){
    let e = this.core.exception(ScenarioException, this.abort, msg, code);
    if(ret) return e;
    else throw e;
  }

  /* Throws special Exception.
   */
  tobecontinued(msg, ret){
    let e = this.core.exception(ScenarioExceptionContinuable, this.tobecontinued, msg);
    if(ret) return e;
    else throw e;
  }

  /* Writes down dictation info into logs.
   *
   * ( d:any
   * ) -> void
   *
   */
  dictate(d){
    this.dictation_engine.log({
      level: 'dictation',
      message: FM.vr.stringify(d)
    });
  }

  /*
   */
  format_dict(o){
    // simple object formatter
    let fmtd = {};
    if(o instanceof Array){
      return o.map((a) => {
        return this.format_dict(a);
      });
    }
    else if(o instanceof Object){
      if(o.constructor !== Object){
        return '[' + o.constructor.name + ']';
      }
      for(let k in o){
        if(o[k] && (o[k] instanceof Object)){
          fmtd[k] = this.format_dict(o[k]);
        }else{
          fmtd[k] = o[k];
        }
      }
      return fmtd;
    }else{
      return o;
    }
  }

  /* Generates dictation object from Scnene instance.
   *
   * ( Scene
   * ) -> object
   *
   */
  gen_dictation(taken, upd){
    return Object.assign(upd || {}, {
      process_uuid: this.process_uuid,
      uri: taken.protocol.pathname,
      class: taken.story.constructor.name,
      status: (!taken.error.length),
      premise: taken.premise,
      argument: taken.argument ? this.format_dict(taken.argument) : {},
      result: taken.result,
      retry: taken.retry,
      retried: taken.retried || 0,
      error: taken.error,
      memory: taken.story.memory,
      started_at: taken.info.started_at,
      finished_at: new Date()
    });
  }

  /*
   */
  session(nm, v){
    let k = nm || 'default';
    if(!FM.ob.has(this.session_container, nm)){
      this.session_container[k] = [];
    }
    if(FM.vr.is_a(v)){
      this.session_container[k] = v;
    }
    return this.session_container[k];
  }

}


