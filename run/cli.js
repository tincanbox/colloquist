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

  await (factory().process());

})(global, function(){

  async function process(){
    try{
      let colloquist = require("../lib/colloquist");
      let c = new colloquist();
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
