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
      let hp = __dirname.split(path.sep + "node_modules" + path.sep);
      let app = "";
      if(hp.length >= 2){
        app = hp[hp.length - 2];
      }else{
        app = path.resolve(__dirname + path.sep + '..');
        //throw "colloquist should not be used directly or as symlinked.";
      }

      let c = new colloquist({
        project: path.dirname(app),
        launch: 'cli'
      });

      let conf = {};
      try{
        conf = require([app, 'burden', 'config', 'local.js'].join(path.sep));
      }catch(e){
        //
      }

      await c.open(conf);
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
