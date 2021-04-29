const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const engine = require('nunjucks');

module.exports = class Template {

  constructor(core){
    this.core = core;
    /* Default options for EJS module.
     */
    this.option = {
      // autoescape (default: true)
      //   controls if output with dangerous characters are escaped automatically.
      //   See Autoescaping
      // throwOnUndefined (default: false)
      //   throw errors when outputting a null/undefined value
      // trimBlocks (default: false)
      //   automatically remove trailing newlines from a block/tag
      // lstripBlocks (default: false)
      //   automatically remove leading whitespace from a block/tag
      // watch (default: false)
      //   reload templates when they are changed (server-side).
      //   To use watch, make sure optional dependency chokidar is installed.
      watch: true,
      // noCache (default: false)
      //   never use a cache and recompile templates each time (server-side)
      // web
      //   an object for configuring loading templates in the browser:
      // useCache (default: false)
      //   will enable cache and templates will never see updates.
      // async (default: false)
      //   will load templates asynchronously instead of synchronously
      //   (requires use of the asynchronous API for rendering).
      // express
      //   an express app that nunjucks should install to
      // tags: (default: see nunjucks syntax)
      //   defines the syntax for nunjucks tags. See Customizing Syntax
      tags: {
        blockStart:    '<%', blockEnd:      '%>',
        variableStart: '<$', variableEnd:   '$>',
        commentStart:  '<#', commentEnd:    '#>'
      },
    }

    this.engine = new engine.Environment(
      //this.core.config.path.shelf + path.sep
      new (engine.FileSystemLoader.extend({
        getSource(name, callback){
          let p = name;
          if (p.match(/\.([a-z]{2,4})$/)) {
          } else {
            p += '.njk';
          }

          let step = 0;
          let buf, src = '';
          try {
            buf = fs.readFileSync(p);
            src = buf.toString();
          } catch(e) {
            //console.error(e.messsage);
          }

          return { src: src, path: p };
        }
      })),
      this.option
    );

    this.engine.addGlobal('FM', FM);
    this.engine.addGlobal('_', _);
  }

  /* Executes render() from passed string.
   *
   * ( content:string Rendering template conntent.
   *   param:object
   *   option:object
   * ) -> Promise -> String
   *
   */
  async compile(content, param){
    return this.engine.renderString(
      content,
      FM.ob.merge({}, {meta: {}, yield:"", query:{}, post:{}, data:{}}, param)
    );
  }

  /* render
   *
   * ( filepath: string = 
   *   param: object = template's local scope variables.
   * ) -> string
   */
  async render(filepath, param){
    return this.engine.render(
      filepath,
      FM.ob.merge({}, {meta: {}, yield:"", query:{}, post:{}, data:{}}, param)
    );
  }

  /* 
   * ( pathcomp: array = path components like [your, template, path]
   * ) -> string
   */
  async read(pathcomp){
    let f = this.generate_path(pathcomp);
    let tbuf = await fsp.readFile(f);
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
  async load(pathcomp, param){
    let f = this.generate_path(pathcomp);
    return await this.render(f, param);
  }

  /* 
   * ( pathcomp: array = path components like [your, template, path]
   * ) -> string
   */
  generate_path(pathcomp){
    return (typeof pathcomp == "string")
      ? pathcomp
      : this.core.config.path.shelf + path.sep + pathcomp.join(path.sep) + ".njk";
  }

}
