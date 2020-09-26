const fs = require('fs').promises;
const path = require('path');
const os = require('os');

module.exports = class Space {

  constructor(core){
    this.core = core;
    this.engine = null;
    this.context = {};
    this.device = {
      platform: "",
      type: "",
      release: "",
      mac: undefined
    };

    this.default_context_name = "default";

    this.collect_device_info();
  }

  collect_device_info(){
    let nt = os.networkInterfaces();
    for(let k in nt){
      if(k !== 'lo'){
        this.device.mac = nt[k][0].mac;
        break;
      }
    }

    // 'aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', 'win32'
    this.device.platform = os.platform();
    this.device.type = os.type();
    this.device.release = os.release();
  }

  /*
   */
  async launch(){

    //let n = name || "default";
    let E = this.engine || null;

    // Avoids re-gen Puppeteer
    if(E && E.product){
      return this;
    }
    // Awaits Broser generation.
    if(E instanceof Promise){
      await this.engine;
      return this;
    }
    // A..ah...well...
    if(E){
      return this;
    }

    // U may pass.
    let defd;
    this.engine = new Promise((resolve, reject) => {
      defd = {resolve, reject};
    });

    this.core.logger.debug("Launching Space Context...");

    let core = this.core;

    let option = FM.ob.merge({
      headless: core.config.puppet.headless || false,
      sloMo: core.config.puppet.slomo || false,
      defaultViewport: core.config.puppet.viewport || null,
      dumpio: (core.config.puppet.dump) || false,
      timeout: 60000,
      //ignoreHTTPSErrors: true,
      //userDataDir: "your-userdata-dir" || (["tmp", ])this.,
      args: [
        // Official command arguments.
        //'--no-sandbox',
        //'--disable-setuid-sandbox',
        //'--ignore-certificate-errors'
        //'--disable-dev-shm-usage',
        //"--disable-gpu",
        //"--disable-gl-drawing-for-tests",
        //"--disable-software-rasterizer",
        //'--deterministic-fetch',
        //"--proxy-server='direct://'",
        //'--proxy-bypass-list=*',
      ].concat(core.config.puppet.arg)
    }, core.config.puppet.override || {});

    if(!option.executablePath && core.config.puppet.executable){
      option.executablePath = core.config.puppet.executable;
    }

    if(core.config.puppet.keep_userdata && this.device.mac){
      try{
        let cpath = [
          os.tmpdir(),
          "colloquist_storage." + this.device.mac.replace(/:/g, '')
        ].join(path.sep) + path.sep;
        await fs.mkdir(cpath, {
          recursive: true
        });
        option.userDataDir = cpath;
      }catch(e){
        // do nothing
      }
    }

    /* Defines base-instance.  */
    this.engine = await core.vendor.puppeteer.launch(option);
    /* Loades jQuery for injection */
    this.$P_content = (await fs.readFile(this.core.config.base + path.sep + 'lib/vendor/jquery/$P.js')).toString();
    /* Generates new default IncognitoBrowser */
    this.context[this.default_context_name] = await this.generate_incognito_context(this.default_context_name);

    defd.resolve(this.engine);
    return this;
  }

  /*
   */
  async generate_incognito_context(context_name){
    let incog = await this.engine.createIncognitoBrowserContext();
    return this.context[context_name] = incog;
  }

  /* Closes ALL contexts.
   */
  async close(n){
    if(n){
      var s = await this.fetch(n);
      if(s){
        this.core.logger.debug("Closing Space-context: " + n);
        for(let page of await s.pages()){
          await page.close();
        }
        await s.close();
        this.context[n] = null;
      }else{
        throw new Error("Invalid Context name: " + n);
      }
    }else{
      for(var k in this.context){
        await this.close(k);
      }
      for(let page of await this.engine.pages()){
        await page.close();
      }
      if(this.engine){
        this.core.logger.debug("Closing main-engine");
        await this.engine.close();
      }
    }
    return this;
  }

  /* Fetches a named context.
   * ( context_name:string
   * ) -> Puppeteer | false
   */
  async fetch(context_name){
    await this.launch();
    let n = (context_name || this.default_context_name);
    if(this.context[n]){
      return this.context[n];
    }else{
      return await this.generate_incognito_context(n);
    }
  }

  /* Generatess a new page and returns it.
   */
  async flip(context_name){
    let s = await this.fetch(context_name);
    return await this.insert(s);
  }

  /* Inserts new page in context.
   */
  async insert(context){
    var core = this.core;

    if(!context){
      throw new Error("Invalid BrowserContext");
    }

    // Awaits page open.
    let page = await context.newPage();

    page.on('domcontentloaded', async () => {
      try{
        await FM.async.poll(async (rs) => {
          var h = await page.evaluate(() => {
            return document.querySelectorAll('head').length > 0;
          });
          if(h){
            await page.evaluate((j) => {
              /* To apply $P to all frames, Space uses eval().  */
              eval(j);
            }, this.$P_content);
            return rs(true);
          }
        }, 30);
      }catch(e){
        this.core.log_warn("$P injection aborted. => " + FM.vr.stringify(e));
      }
    });

    // CSP
    await page.setBypassCSP(true);

    // UserAgent
    (this.core.config.puppet.useragent)
      && await page.setUserAgent(this.core.config.puppet.useragent);

    // ViewPort
    if(core.config.puppet.display.width && core.config.puppet.display.height){
      await page.setViewport({
        width: core.config.puppet.display.width,
        height: core.config.puppet.display.height,
        deviceScaleFactor: 1
      });
    }

    //@deprecated
    //let session = await page.target().createCDPSession();
    //await session.send('Page.enable');
    //await session.send('Page.setWebLifecycleState', {state: 'active'});

    /* injects global $P jQuery instance.
     */
    //page.on('load', () => {
    //  this.core.logger.debug('[Puppeteer Engine] Load event dispatched');
    //});
    //page.on('pageerror', err => {
    //  this.core.log_warn('[Puppeteer Engine] Page error: ', err);
    //});
    //page.on('error', err => {
    //  this.core.log_warn("[Puppeteer Engine] Error: ", err.message);
    //});

    await page.setRequestInterception(true);
    page.on('request', request => {
      for(let t of core.config.puppet.block.type){
        if(request.resourceType() === t){
          request.abort();
          return;
        }else{
          request.continue();
          return;
        }
      }
      for(let reg of core.config.puppet.block.url){
        if(request.url().match(reg)){
          request.abort();
          return;
        }
      }
      request.continue();
    });

    return page;
  }

  running_on(...arg){
    return (arg.reduce((m, a) => {
      Object.keys(this.device).forEach((k) => {
        (this.device[k].match(a)) && (m.push(this.device[k]));
      });
      return m;
    }, [])).length === arg.length;
  }

}