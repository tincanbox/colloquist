module.exports = function(name, engine, handler, option){

  /* name = Name of this file without ext
   * engine = Engine which retrieved via require()
   * handler = Instantiated Engine.
   * option = factory.option from config/STAGE/database.js
   */

  return handler.model(name, new engine.Schema(
    {
      label: String
    },
    {
      collection: name
    }
  ));
};
