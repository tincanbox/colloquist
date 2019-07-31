#!/usr/local/bin/node
const path = require('path');

/* Very simple app with colloquist.
 */
(async () => {

  /* Loads core class.
   */
  const colloquist = require([__dirname, '..','lib','colloquist'].join(path.sep));

  /* Instantiates colloquist with burden dir configuration.
   */
  var c = new colloquist({
    // Set a path which includes burden dir.
    burden: path.resolve([__dirname, '..', 'burden'].join(path.sep))
  });

  /* Start colloquist basics.
   */
  await c.open({
    more_arg: 123
  });

  /* Observe command-line arguments.
   */
  await c.execute();

})();
