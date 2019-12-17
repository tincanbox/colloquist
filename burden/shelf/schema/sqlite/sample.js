module.exports = function(name, engine, handler, option){
  var M = class extends engine.Model {}

  /* name = Name of this file without ext
   * engine = Engine which retrieved via require()
   * handler = Instantiated Engine.
   * option = factory.option from config/STAGE/database.js
   */

  /* create table sample (
   *   id INTEGER PRIMARY KEY,
   *   label TEXT,
   *   created_at DATETIME,
   *   updated_at DATETIME,
   *   deleted_at DATETIME,
   *   version INTEGER
   * )
   *
   */

  M.init({
    label: engine.DataTypes.STRING
  }, option);

  return M;
}
