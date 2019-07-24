/*
 * Requires
 * puppeteer
 */
const path = require('path');
const TITLE = String.raw`
<yellow> _______  _______  ______    _______  _______ </yellow><cyan> _______  _______  _______  ___   _ </cyan>
<yellow>|       ||       ||    _ |  |   _   ||       |</yellow><cyan>|  _    ||       ||       ||   | | |</cyan>
<yellow>|  _____||       ||   | ||  |  |_|  ||    _  |</yellow><cyan>| |_|   ||   _   ||   _   ||   |_| |</cyan>
<yellow>| |_____ |       ||   |_||_ |       ||   |_| |</yellow><cyan>|       ||  | |  ||  | |  ||      _|</cyan>
<yellow>|_____  ||     __||    __  ||       ||    ___|</yellow><cyan>|  _   | |  |_|  ||  |_|  ||     |_ </cyan>
<yellow> _____| ||    |__ |   |  | ||   _   ||   |    </yellow><cyan>| |_|   ||       ||       ||    _  |</cyan>
<yellow>|_______||_______||___|  |_||__| |__||___|    </yellow><cyan>|_______||_______||_______||___| |_|</cyan>
`;

(async (root, factory) => {

  await (factory().process());

})(global, function(){

  async function process(){
    try{
      let basedir = path.resolve(path.dirname(require.main.filename) + "/../") + "/";
      let core = require(basedir + "/lib/core");
      let c = new core({
        config: basedir + 'config/core.js'
      });
      //@see config/draft/demo.js
      await c.open({});

      c.logger.plain({
        level: 'info',
        message: TITLE
      });
      c.log("arg: " + FM.ob.stringify(c.arg));

      await c.recite(c.arg.draft);
      return c;
    }catch(e){
      console.log("Uncaught Error:");
      console.error(e);
    }
  }

  return {
    process: process
  }

});
