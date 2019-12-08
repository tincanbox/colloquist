module.exports = {
  default: {
    port: 9000,
    prepare: async function(server){

      var block_list = [
        "/favicon.ico"
      ];

      var data = FM.ob.define({
        post: {},
        result: []
      });


      async function load_view(req, param){
        var t = req.url.split("?").shift().replace(/^\//, "");
        t = "view/" + t + ".ejs";
        try{
          var view = await server.core.template.load(
            t.split("/"), data(FM.ob.merge({}, req.query || {}, param))
          );
          return view;
        }catch(e){
          console.log(e);
        }
      }

      server.router.all('*', function(req, res, next){
        // Blocks stupid request.
        if(block_list.indexOf(req.url) > -1){
          console.log("Blocked: ", req.url);
          return res.status(404).end();
        }
        next();
      });

      /* Really simple routing.
       */
      server.engine.get('*', async function(req, res){
        var v = await load_view(req);
        res.send(v);
      });

      server.engine.post('*', async function(req, res){
        var t = req.url.replace(/^\//, "");
        var c = await server.core.run(t);
        var v = await load_view(req, {
          post: req.body,
          result: c.scenario.passed
        });
        res.send(v);
      });

    }
  }
};
