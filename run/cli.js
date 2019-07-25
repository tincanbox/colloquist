#!/usr/bin/env node
/*
 * Requires
 * puppeteer
 */
const path = require('path');
const TITLE = (function title(){
/*DOC

<cyan>   ___          .    .                                  .    </cyan>
<cyan> .'   \   __.   |    |     __.    ___.  ,   . -   ____ _/_   </cyan>
<cyan> |      .'   \  |    |   .'   \ .'   |  |   | |  (      |    </cyan>
<cyan> |      |    |  |    |   |    | |    |  |   | |  `--.   |    </cyan>
<cyan>  `.__,  `._.' /\__ /\__  `._.'  `---|. `._/| / \___.'  \__/ </cyan>
<cyan>                                     |/                      </cyan>

DOC*/
  var tag = "DOC";
  var reobj = new RegExp("/\\*"+tag+"\\n[\\s\\S]*?\\n"+tag+"\\*/", "m");
  var str = reobj.exec(title).toString();
  str = str.replace(new RegExp("/\\*"+tag+"\\n",'m'),'').toString();
  return str.replace(new RegExp("\\n"+tag+"\\*/",'m'),'').toString();
})();

(async (root, factory) => {

  await (factory().proc());

})(global, function(){

  async function proc(){
    try{
      let colloquist = require("../lib/colloquist");
      var cwd = __dirname.split("/node_modules/");
      var app = "";
      if(cwd.length >= 2){
        app = cwd[0];
      }else{
        throw "colloquist should not be used directly or as symlinked.";
      }

      let c = new colloquist(require([app, 'burden', 'config', 'core.js'].join(path.sep)));
      await c.open();
      await c.execute();
      return c;

    }catch(e){
      console.log("Uncaught Error:");
      console.error(e);
    }
  }

  return {
    proc: proc
  }

});
