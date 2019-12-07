module.exports = {
  default: {
    port: 9000,
    prepare: async function(server){

      server.router.get('*', async function(ctx){
        console.log("Request URL:", ctx.request.url);

        // Blocks stupid request.
        var block = [
          "/favicon.ico"
        ];
        if(block.indexOf(ctx.request.url) > -1){
          return;
        }

        var t = ctx.request.url.replace(/^\//, "");
        var c = await server.core.run(t);
        ctx.body = c.scenario.passed;
      });

      server.engine.use(server.router.routes());
      server.engine.use(server.router.allowedMethods());
    }
  }
};
