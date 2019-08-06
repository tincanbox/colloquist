#!/usr/bin/env node
/*
 * Requires
 * puppeteer
 */
const path = require('path');

(async (root, factory) => {

  await (factory().proc());

})(global, function(){

  async function proc(){
    try{
      let colloquist = require("../lib/colloquist");

      let c = new colloquist({
        burden: process.cwd() + path.sep + 'burden'
      });

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
