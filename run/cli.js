/*
 * Requires
 * puppeteer
 */
const path = require('path');
const TITLE = (function title(){
/*HERE
   ___          .    .                                  .
 .'   \   __.   |    |     __.    ___.  ,   . -   ____ _/_
 |      .'   \  |    |   .'   \ .'   |  |   | |  (      |
 |      |    |  |    |   |    | |    |  |   | |  `--.   |
  `.__,  `._.' /\__ /\__  `._.'  `---|. `._/| / \___.'  \__/
                                     |/
HERE*/
  var here = "HERE";
  var reobj = new RegExp("/\\*"+here+"\\n[\\s\\S]*?\\n"+here+"\\*/", "m");
  var str = reobj.exec(title).toString();
  str = str.replace(new RegExp("/\\*"+here+"\\n",'m'),'').toString();
  return str.replace(new RegExp("\\n"+here+"\\*/",'m'),'').toString();
})();

(async (root, factory) => {

  await (factory().process());

})(global, function(){

  async function process(){
    try{
      let curdir = path.dirname(require.main.filename);
      let basedir = path.resolve(curdir + "/../") + "/";
      let colloquist = require(basedir + "/lib/colloquist");
      let c = new colloquist({
        config: require(basedir + 'config/core.js')
      });
      //@see config/draft/demo.js
      await c.open();

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
