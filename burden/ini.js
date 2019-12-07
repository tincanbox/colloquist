const path = require('path');
let app = path.resolve([__dirname, '..'].join(path.sep));
module.exports = {
  path: {
    app: app,
    log: [app, 'log'].join(path.sep),
    config: [app, 'burden', 'config'].join(path.sep),
    shelf: [app, 'burden', 'shelf'].join(path.sep),
    story: [app, 'burden', 'shelf', 'story'].join(path.sep),
    draft: [app, 'burden', 'shelf', 'draft'].join(path.sep),
    schema: [app, 'burden', 'shelf', 'schema'].join(path.sep),
    template: [app, 'burden', 'shelf', 'template'].join(path.sep),
  }
}
