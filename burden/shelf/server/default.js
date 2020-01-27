/* Default server implementation.
 * You can completely overrides Server's behavior via this file.
 * (You prefer other frameworks? as you wish.)
 *
 * This Class should have only init() method to hook the server instantiation.
 */
const formidable = require('formidable');

module.exports = class {

  constructor(core, engine, config){
    this.core = core;
    this.config = config;
    this.engine = engine;
    this.code_list = require('./codes.json');

    /* Blocking URL RegExp list */
    this.block_list = [
      /*
      /favicon.ico$/
      */
    ];
  }

  /* @required
   */
  async init(/* pass what you want from config/server.prepare file. */){
    this.bind_pre_middleware();
    this.bind_route();
    this.bind_post_middleware();
  }

  /* Closes express.Response with specific http-code.
   */
  async close(res, code){
    let m = this.code_list.find((a) => { return a.code == (code + ""); });
    if(m){
      res.status(code || 500).end(code + " " + m.phrase);
    }
  }

  /* Binds pre-route middlewares.
   */
  bind_pre_middleware(){
    this.engine.use('*', (req, res, next) => {
      /* DO SOME GLOBAL THINGS. */
      next();
    });
    this.engine.use((req, res, next) => {
      // Blocks stupid request.
      let mt = this.block_list.filter((v) => {
        return req.url.match(v);
      });
      if(mt.length > 0){
        console.log("  -> Blocked");
        this.close(res, 403);
      }
      next();
    });
  }

  /* Binds post-route middlewares.
   */
  bind_post_middleware(){
    // NOT matched at all.
    this.engine.use((req, res) => {
      this.close(res, 404);
    });
  }

  /* Binds basic route-groups.
   */
  bind_route(){
    this.engine.use('/api/*', (req, res, next) => {
      res.type('json');
      next();
    });

    this.engine.get('/run/*', (req, res, next) => {
      res.type('json');
      this.redirect_request(req, res, next);
    });

    this.engine.post('/run/*', (req, res, next) => {
      res.type('json');
      this.retrieve_upload_file(req)
        .then(() => {
          this.redirect_request(req, res, next);
        })
    });

    this.engine.get('/gui/*', (req, res) => {
      res.type('html');
      this.render_page("gui", req)
        .then((t) => {
          res.send(t);
        });
    });

    this.engine.post('/gui/*', (req, res) => {
      res.type('html');
      this.render_page("gui", req, {post: req.body || {}})
        .then((t) => {
          res.send(t);
        });
    });

  }

  /* Retrieves uploaded files info as
   * {name_of_input: IncomingForm}
   */
  async retrieve_upload_file(req){
    return new Promise((resolve, reject) => {
      let f = new formidable.IncomingForm();
      f.parse(req, (err, fields, files) => {
        if(err){
          reject(err);
        }else{
          req.file = files;
          resolve(req);
        }
      });
    });
  }

  /* Redirects URL to core.recite().
   */
  async redirect_request(req, res){
    let t = req.url.replace(/^\/run\//, "");
    if(!t){
      res.status(404).end();
    }else{
      await this.core.recite(
        t,
        {...(req.query || {}), ...(req.body || {}), ...{request: req, response: res} }
      )
      .then((r) => res.json(r));
    }
  }

  /* Generates rendered HTML with template-path.
   */
  async render(pathcomp, data){
    let t = await this.core.template.read(pathcomp);
    let d = FM.ob.merge({}, {yield:"", data:{}}, data);
    let v = await this.core.template.render(t, d);
    return v;
  }

  /* Generates HTML as yielded contents with view/layout.
   */
  async render_page(group, req, param){
    let rg = new RegExp("^/" + group + "/");
    let t = req.url.split("?").shift().replace(rg, "");
    t = "view/" + (t || "index");
    try{
      let y = await this.render(t.split("/").filter(r => r), param);
      let l = await this.render(['view', 'layout'], FM.ob.merge({
        yield: y,
        query: req.query || {},
        post: req.body || {},
      }, param));
      return l;
    }catch(e){
      console.error(e);
    }
  }

}
