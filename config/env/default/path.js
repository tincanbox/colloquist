const path = require('path');
const basedir = path.resolve(path.dirname(require.main.filename) + "/../../") + "/";

module.exports = () => {
  return {
    base: basedir + "/",
    lib: basedir + "/lib/",
    log: basedir + "/log/",
    board: basedir + '/board/'
  }
}
