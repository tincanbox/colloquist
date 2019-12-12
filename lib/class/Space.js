const fs = require('fs').promises;
const path = require('path');
const os = require('os');

module.exports = class Space {
  constructor(core){
    this.core = core;
    this.identifier = null;
    this.engine = null;
    this.context = {};
    this.device = {
      mac: undefined
    };
  }

  async launch(context_name){
    this.core.debug("Launching Space...");
    var n = context_name || "default";

    if(this.context[n]){
      return this.context[n];
    }

    this.identifier = n;

    var nt = os.networkInterfaces();
    for(var k in nt){
      if(k != 'lo'){
        this.device.mac = nt[k][0].mac;
        break;
      }
    }

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
          os.tmpdir(), "colloquist_storage." + this.device.mac.replace(/:/g, '') + "." + this.identifier
        ].join(path.sep) + path.sep;
        await fs.mkdir(cpath, {
          recursive: true
        });
        option.userDataDir = cpath;
      }catch(e){
        // do nothing
      }
    }

    /* Defines base-instance.
     */
    this.engine = await core.vendor.puppeteer.launch(option);

    /* Generates new context.
     */
    this.context[n] = await this.create(n);

    this.$P_content = (await fs.readFile(this.core.config.base + path.sep + 'lib/vendor/jquery/$P.js')).toString();

    return this;
  }

  async create(context_name){
    var b = await this.fetch(context_name);
    if(b){
      return b;
    }else{
      let incog = await this.engine.createIncognitoBrowserContext();
      return this.context[context_name] = incog;
    }
  }

  async close(n){
    if(n){
      var s = await this.fetch(n);
      if(s){
        await s.close();
        this.context[n] = null;
      }
    }else{
      for(var k in this.context){
        await this.close(k);
      }
      await this.engine.close();
    }
    return this;
  }

  async fetch(context_name){
    var n = (context_name || "default");
    if(!this.engine){
      await this.launch(context_name);
    }
    if(this.context[n]){
      return this.context[n];
    }else{
      return false;
    }
  }

  /* Flips a page and returns new one.
   */
  async flip(context_name){
    var s = await this.fetch(context_name);
    if(!s){
      s = await this.create(context_name);
    }
    let r = await this.insert(s);
    return r;
  }

  /* Inserts new page in context.
   */
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

    page.on('domcontentloaded', async () => {
      try{
        await FM.async.poll(async (rs) => {
          var h = await page.evaluate(() => {
            return document.querySelectorAll('head').length > 0;
          });
          if(h){
            await page.evaluate((j) => {
              /*
              To apply $P to all frames, uses eval().
              var s = document.createElement('script');
              s.type = 'text/javascript';
              s.innerText = j;
              document.getElementsByTagName('head')[0].appendChild(s);
              */
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
