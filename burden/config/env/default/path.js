const path = require('path');
let app = path.resolve([__dirname, '..', '..', '..'].join(path.sep));
module.exports = {
  app: app,
  log: [app, 'log'].join(path.sep),
  config: [app, 'burden', 'config'].join(path.sep),
  shelf: [app, 'burden', 'shelf'].join(path.sep)
}
