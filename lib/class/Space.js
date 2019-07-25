const fs = require('fs').promises;
const path = require('path');

module.exports = class Space {
  constructor(core){
    this.core = core;
    this.engine = null;
    this.context = {};
  }

  async launch(){
    if(this.engine){
      return this.engine;
    }

    let core = this.core;

    this.engine = await core.vendor.puppeteer.launch({
      headless: core.config.puppet.headless || false,
      sloMo: core.config.puppet.slomo || false,
      defaultViewport: core.config.puppet.viewport || null,
      //userDataDir: core.config.path.storage + "user_data",
      dumpio: (core.config.puppet.dump) || false,
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--ignore-certificate-errors'
        /*
        (core.config.puppet.display.width && core.config.puppet.display.height)
        ?  `--window-size=${ core.config.puppet.display.width },${ core.config.puppet.display.height }`
        :  "",
        '--disable-dev-shm-usage',
        "--disable-gpu",
        "--disable-gl-drawing-for-tests",
        "--disable-software-rasterizer",
        '--deterministic-fetch',
        "--proxy-server='direct://'",
        '--proxy-bypass-list=*',
        */
      ]
    });

    this.context["default"] = this.engine;

    this.$P_content = (await fs.readFile(this.core.config.base + path.sep + 'lib/vendor/jquery/$P.js')).toString();

    return this;
  }

  async create(n){
    var b;
    if(n){
      b = this.fetch(n);
      if(b){
        return b;
      }else{
        let incog = await this.engine.createIncognitoBrowserContext();
        return this.context[n] = incog;
      }
    }else{
      return this.fetch();
    }
  }

  async close(n){
    if(n){
      var s = this.fetch(n);
      if(s){
        await s.close();
        this.context[n] = null;
      }
    }else{
      for(var k in this.context){
        await this.close(k);
      }
    }
    return this;
  }

  fetch(n){
    var n = (n || "default");
    if(this.context[n]){
      return this.context[n];
    }
    return false;
  }

  async flip(cname){
    var s = this.fetch(cname);
    if(!s){
      s = await this.create(cname);
    }
    let r = await this.insert(s);
    return r;
  }

  async insert(context){
    var core = this.core;

    if(!context){
      throw new Error("Invalid BrowserContext");
    }

    // Awaits page open.
    let page = await (async () => {
      var p = await context.newPage();
      return p;
    })();

    (this.core.config.puppet.useragent) && await page.setUserAgent(this.core.config.puppet.useragent);

    if(core.config.puppet.display.width && core.config.puppet.display.height){
      await page.setViewport({
        width: core.config.puppet.display.width,
        height: core.config.puppet.display.height,
        deviceScaleFactor: 1
      });
    }

    //let session = await page.target().createCDPSession();
    //await session.send('Page.enable');
    //await session.send('Page.setWebLifecycleState', {state: 'active'});

    /* injects global $P jQuery instance.
     */
    //page.on('load', () => {
    //  this.core.debug('[Puppeteer Engine] Load event dispatched');
    //});
    //page.on('pageerror', err => {
    //  this.core.log_warn('[Puppeteer Engine] Page error: ', err);
    //});
    //page.on('error', err => {
    //  this.core.log_warn("[Puppeteer Engine] Error: ", err.message);
    //});

    await page.setRequestInterception(true);
    page.on('request', request => {
      for(var t of core.config.puppet.block.type){
        if(request.resourceType() == t){
          request.abort();
          return;
        }else{
          request.continue();
          return;
        }
      }
      for(var reg of core.config.puppet.block.url){
        if(request.url().match(reg)){
          request.abort();
          return;
        }
      }
      request.continue();
    });

    return page;
  }


}
