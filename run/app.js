const path = require('path');

(async () => {

  const colloquist = require([__dirname, '..','lib','colloquist'].join(path.sep));

  var c = new colloquist({
    // Set a path which includes burden dir.
    burden: path.resolve(__dirname + path.sep + '..')
  });

  await c.open({
    foo: 2
  });
  await c.recite('sample');

})();
