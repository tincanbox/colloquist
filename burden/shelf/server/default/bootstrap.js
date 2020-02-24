/* Default server implementation.
 * This definition is really simple one.
 * You may need user-auth flow, security-check flow as well.
 * But you can completely overrides Server's behavior via each bootstrap.js file.
 * (You prefer other frameworks? as you wish.
 *  Just stop using server.framework as main server constructor.)
 *
 * This Class should have only init() method to hook the server instantiation.
 * `npx colloquist server %YOUR_SERVER_NAME%` calls your bootstrap.init() .
 */
const formidable = require('formidable');
const fs = require('fs').promises;
const path = require('path');
const uuid = require('uuid');

module.exports = class {

  constructor(core, config){
     this.SERVER_NAME = ""; // assigned by colloquist.server
    this.core = core;
    this.config = config;
    this.engine = new this.core.server.framework;
    this.response_code_list = require('../codes.json');

    this.config.path = this.config.path || {};
  }

  /* @required
   */
  async init(/* pass what you want from config/server.prepare file. */){

    let e = this.engine;

    e.use(this.core.server.session(this.config.session || {}));

    await this.bind_pre_middleware();
    await this.bind_route();
    await this.bind_post_middleware();

    e.listen(this.config.port);
    this.core.logger.debug("Server is listening on Port:" + this.config.port);
  }

  /* Closes express.Response with specific http-code.
   */
  async close(arg, code, callback){
    let [req, res] = arg;

    let info = this.response_code_list.find((a) => { return a.code == (code + ""); });
    if(!info){
      info = this.response_code_list.find((a) => { return a.code == "500"; });
    }
    res.status(info.code);

    this.core.logger.info("Location:" + req.url + " " + info.code);

    if(callback){
      callback(arg, info);
    }else{
      this.show_error(arg, info, info.phrase);
    }
  }

  /* Binds pre-route middlewares.
   */
  async bind_pre_middleware(){
    // Global Handler
    this.engine.use((req, res, next) => {
      /* DO SOME GLOBAL THINGS. */
      req.token = uuid();
      req.body = req.body || {};
      req.query = req.query || {};
      //
      if(this.config.url_auth){
        var sig = this.config.url_auth.split(":");
        if(sig.length < 2){
          sig = ["SIGNATURE", sig[0]];
        }
        if(!req.query[sig[0]] || req.query[sig[0]] != sig[1]){
          this.close(arguments, 403);
          return;
        }
      }
      next();
    });
    // BASIC auth
    if(this.config.auth.basic && this.config.auth.basic.length){
      this.engine.use((req, res, next) => {
        // parse login and password from headers
        const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
        const [usr, psw] = new Buffer(b64auth, 'base64').toString().split(':');
        // Verify login and password are set and correct
        var cred = this.config.auth.basic;
        if(typeof cred === 'string')
          cred = [cred];
        for(var au of cred){
          if(typeof au === 'string')
            au = au.split(":");
          if (usr && psw && (usr === au[0]) && (psw === au[1]))
            return next()
        }
        // Access denied
        res.set('WWW-Authenticate', 'Basic realm="401"');
        return this.close(arguments, 401);
      });
    }
    // Bloking
    this.engine.use((req, res, next) => {
      // Blocks stupid request.
      let mt = [];
      for(let bu of this.config.block.url){
        if(req.url.match(bu)){
          mt.push(bu);
          break;
        }
      }
      let tp = req.get('content-type');
      for(let bt of this.config.block.type){
        if(tp.match(bt)){
          mt.push(bt);
          break;
        }
      }
      if(mt.length > 0){
        console.log("  -> Blocked: ", mt.join(", "));
        this.close(arguments, 403);
      }
      next();
    });
    // Other Globals
    this.engine.use((req, res, next) => {
      this.retrieve(req)
        .then(() => {
          next();
        })
        .catch((e) => {
          this.core.logger.error(e);
        })
    })
    // Assets
    if(this.config.expose && this.config.expose.length){
      try{
        let bs = this.core.config.path.burden;
        for(let f of this.config.expose){
          // [name, path]
          let nm = f[0], pt = f[1];
          let p = path.resolve(pt.match(/^\//) ? pt : bs + pt);
          let st = await fs.stat(p);
          if(!st.isDirectory(p))
            throw new Error("asset path is not a directory.");
          this.engine.use('/' + nm, this.core.server.framework.static(p));
          this.config.path.expose = this.config.path.expose || {};
          this.config.path.expose[nm] = p;
          this.core.logger.debug("asset path: " + nm + " => " + p);
        }
      }catch(e){
        this.core.logger.error(new Error("Invalid asset-dir config: " + e.message));
      }
    }else{
      this.core.logger.debug("sever.asset is disabled.");
    }
  }

  /* Binds post-route middlewares.
   */
  async bind_post_middleware(){
    // NOT matched at all.
    this.engine.use((req, res, next) => {
      this.close(arguments, 404);
    });
  }

  /* Binds basic route-groups.
   */
  async bind_route(){
    this.engine.use('/api/*', (req, res, next) => {
      res.type('json');
      next();
    });

    this.engine.get('/run/*', (req, res, next) => {
      res.type('json');
      let url = req.url.replace(/^\/run\//, "");
      this.redirect_request(url, req, res, next)
        .then(r => res.json(r))
        .catch(r => res.json(r));
    });

    this.engine.post('/run/*', (req, res, next) => {
      res.type('json');
      let url = req.url.replace(/^\/run\//, "");
      this.redirect_request(url, req, res, next)
        .then(r => res.json(r))
        .catch(r => res.json(r));
    });

    this.engine.get('/bucket', (req, res) => {
      if(req.query.file){
        return res.download(this.config.path.expose.bucket + path.sep + req.query.file);
      }
      this.close(arguments, 404);
    });

    this.engine.get('/*', (...arg) => {
      let [req, res] = arg;
      res.type('html');
      this.render_direct_view(req, {})
        .then((r) => { res.send(r); })
        .catch((e) => {
          this.handler_render_error(arg, e);
        });
    });

    this.engine.post('/*', () => {
      let arg = [req, res] = arguments;
      res.type('html');
      this.render_direct_view(req, {})
        .then((r) => { res.send(r); })
        .catch((e) => {
          this.handler_render_error(arg, e);
        });
    });
  }

  /*
   */
  async show_error(arg, info, content){
    let [req, res] = arg;

    // msg
    let msg;
    if(content instanceof Error){
      msg = content.message;
    }else if(typeof content == "string"){
      msg = content;
    }else{
      msg = JSON.stringify(content);
    }

    let ct = res.get('content-type');
    // type
    if(ct.match('text/*')){
      try{
        let html = await this.render(['error', info.code], {
          content: content,
          message: msg
        });
        res.send(html);
      }catch(e){
        console.error(e);
        res.end(msg);
      }
    }else if(ct.match('application/json')){
      res.json({ error: msg });
    }else{
      res.end(msg);
    }

    return true;
  }

  /* Retrieves posted form-data
   */
  async retrieve(req){
    let self = this;
    return new Promise((resolve, reject) => {
      let form = new formidable.IncomingForm();
      let fds = [];
      // Events
      form
        .on('field', (k, v) => {
          fds.push([k, v]);
        })
        .on('error', (err) => {
          reject(err);
        })
        .on('file', (field, file) => {
          req.file = req.file || {};
          req.file[field] = file;
        })
        .on('aborted', (err) => {
          self.core.logger.debug("Request Aborted");
        })
        .on('end', () => {
          let o = FM.ob.unserialize(fds);
          req.body = Object.assign(req.body || {}, o);
        });
      // lets go
      form.parse(req, (err /*, fields, files */) => {
        if(err){
          reject(err);
        }else{
          resolve(req);
        }
      });
    });
  }

  /* Redirects URL to core.recite().
   *
   * ( req:IncomingMessage
   * ) -> void
   */
  async redirect_request(url, ...arg){
    let [req, res] = arg;
    try{
      if(!url){
        this.close(arg, 404);
      }else{
        let p = {...(req.query || {}), ...(req.body || {}), ...{file: req.file || {}} };
        // Scene arguments.
        let c = { enumerable: false, configurable: false };
        Object.defineProperty(p, 'server', Object.assign({value: this}, c));
        Object.defineProperty(p, 'request', Object.assign({value: req}, c));
        Object.defineProperty(p, 'response', Object.assign({value: res}, c));
        // Lets go.
        let r = await this.core.tell(url, p)
          .then((r) => {
            return { data: r };
          })
          .catch((e) => {
            return { error: e.message };
          });

        return r;
      }
    }catch(e){
      return { error: e.message };
    }
  }

  /* Generates rendered HTML with template-path.
   * ( pathcomp:array
   *   data:object
   * ) -> Promise -> string
   */
  async render(pathcomp, data){
    let d = FM.ob.merge({}, {yield:"", data:{}}, data);
    let f = ['server', this.SERVER_NAME, 'template'].concat(pathcomp);
    let r = await this.core.template.load(f, d);
    return r;
  }

  /* Generates HTML as yielded contents with view/layout.
   *
   * ( base_url = string
   *   req    = IncomingMessage
   *   param  = object
   * ) -> Promise -> String
   */
  async render_direct_view(req, param){
    let pm = param || {};
    let t = req.url.split("?").shift();
    t = "/page/" + ((!t || t.match(/\/$/)) ? t + "index" : t);
    let m = FM.ob.merge({
      token: req.token,
      query: req.query || {},
      post: req.body || {},
      meta: Object.assign({
        title: this.core.config.label,
        description: "",
        copyright: "",
        keywords: "",
        canonical: req.url
      }, pm.meta || {})
    }, pm);
    let y = await this.render(t.split("/").filter(r => r), m);
    return y;
  }

  handler_render_error(com, e){
    this.core.logger.error(e);
    if(e.message.match("template not found")){
      this.close(com, 404);
    }else{
      this.close(com, 500, (arg, info) => { this.show_error(arg, info, e); });
    }
  }

}
