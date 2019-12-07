module.exports = {
  default: {
    port: 9000,
    prepare: async function(server){

      server.router.get('*', async function(ctx){
        console.log("Request URL:", ctx.request.url);
        var t = ctx.request.url.replace(/^\//, "");
        var c = await server.core.run(t);
        ctx.body = c.scenario.passed;
      });

      server.engine.use(server.router.routes());
      server.engine.use(server.router.allowedMethods());
    }
  }
};
