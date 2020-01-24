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
    this.core.debug('Scribing drafts into opened Scenario...');
    let pr = await Promise.all(this.collect(drafts, arg));
    let rs = await this.story_chain(pr)
    return rs;
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
    let protocol = null, argument = {}, file = "";

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
    if(FM.vr.type(draft) == 'array'){
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
      switch(true){
        case s instanceof Array:
          return this.collect(s, arg);
        default:
          return this.take(s, arg);
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
        this.abort(e);
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
  take(draft, arg){
    let r = new Scene(this, draft, arg);
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
        let r = await taken.read();

        if(taken.space_autoload){
          // Recovers cookies.
          if(taken.space_session){
            this.session(taken.space_session, await taken.retrieve_session());
          }
        }

        (!taken.space_keep) && await this.close(taken);
        (taken.done && FM.vr.is_f(taken.done)) && await taken.done.call(taken);

        return r;
      };

      let handler = async (e) => {
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
          if(e instanceof ScenarioException){
            taken.error.push(e);
            throw e;
          }else{
            let de = new ScenarioException(e, 100);
            taken.error.push(de);
            throw de;
          }
        }
      };

      let proc = async () => {
        try{
          seq++;
          try{
            return await main();
          }catch(e){
            await handler(e);
          }
        }finally{
          this.gen_dictation(taken, dict);
          this.dictate(dict);
          if(!this.reminiscence.includes(dict)){
            this.reminiscence.push(dict);
          }
        }
      }

      let retry = async (fn) => {
        while(fn){
          try{
            return await fn();
          }catch(e){
            if(seq && seq <= taken.retry){
              taken.retried = seq;
              this.core.debug("...retrying -> " + seq);
            }else{
              await this.close(taken);
              throw e;
            }
          }finally{
            //
          }
        }
      }

      return await retry(proc);

    }catch(e){
      this.core.debug("Exception@Scenario.reflect");
      throw e;
    }
  }

  /* Closes all Puppeteer instances related to specified Scene.
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
      status: (taken.error.length) ? false : true,
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


