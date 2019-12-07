module.exports = function(name, engine, handler, config){
  return handler.model(name, new engine.Schema(
    {
      label: String
    },
    {
      collection: name
    }
  ));
};
