/* Core configurations.
 */

const path = require('path');

module.exports = (param) => {
  var basedir = path.resolve(path.dirname(param.config) + "/../");
  return {
    path: {
      base: basedir + "/",
      lib: basedir + "/lib/",
      log: basedir + "/log/",
      board: basedir + '/board/'
    }
  }
}
