const fsp = require('fs').promises;
const path = require('path');
const engine = require('ejs');

module.exports = class Template {

  constructor(core){
    this.core = core;
    this.engine = engine;
    /* Default options for EJS module.
     */
    this.option = {
      // cache Compiled functions are cached, requires filename
      cache: true,
      // filename Used by cache to key caches, and for includes
      // context Function execution context
      // compileDebug When false no debug instrumentation is compiled
      // client Returns standalone compiled function
      // delimiter Character to use with angle brackets for open/close
      // debug Output generated function body
      // _with Whether or not to use with() {} constructs. If false then the locals will be stored in the locals object.
      // localsName Name to use for the object storing local variables when not using with Defaults to locals
      // rmWhitespace Remove all safe-to-remove whitespace, including leading and trailing whitespace. It also enables a safer version of -%> line slurping for all scriptlet tags (it does not strip new lines of tags in the middle of a line).
      // escape The escaping function used with <%= construct. It is used in rendering and is .toString()ed in the generation of client functions. (By default escapes XML).
      // outputFunctionName Set to a string (e.g., 'echo' or 'print') for a function to print output inside scriptlet tags.
      // async When true, EJS will use an async function for rendering. (Depends on async/await support in the JS runtime.
    }
  }

  /* Executes render() from passed string.
   *
   * ( str:string Rendering template conntent.
   *   param:object
   *   option:object
   * ) -> Promise -> String
   *
   */
  async render(str, param, option){
    let o = option || {};
    o.cache = o.filename ? true : false;

    return this.engine.render(
      str,
      FM.ob.merge({}, {meta: {}, yield:"", query:{}, post:{}, data:{}}, param),
      FM.ob.merge({}, this.option, o)
    );
  }

  async read(pathcomp){
    var f = this.generate_path(pathcomp);
    var tbuf = await fsp.readFile(f);
    return tbuf.toString();
  }

  /* loads up and renders from file.
   *
   * ( pathcomp:array
   *   param:object
   *   option:object
   * ) -> Promise -> String
   *
   */
  async load(pathcomp, param, option){
    // gens OS specified path.
    var o = option || {};
    var t = await this.read(pathcomp);
    var f = this.generate_path(pathcomp);

    o.filename = f;
    return await this.render(t, param, o);
  }

  generate_path(pathcomp){
    return this.core.config.path.template + path.sep + pathcomp.join(path.sep) + ".ejs";
  }

}
