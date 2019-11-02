/* Local configurations.
 */

module.exports = {
  label: process.env.APPNAME || "YOURAPPNAME",
  stage: process.env.ENVIRONMENT || "devel",

  puppet: {
    // chromium executable from `npm install -g chromium` on Ubuntu.
    executable: "/usr/local/lib/node_modules/chromium/lib/chromium/chrome-linux/chrome"
  }

}
