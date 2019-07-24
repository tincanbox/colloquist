/* Configurations for Puppeteer
 */
module.exports = {
  "headless": false,
  "viewport": null,
  "display": {
    "width": false,
    "height": false
  },
  "max_concurrent_work": process.env.CONF_PUPPET_MAX_CONCURRENT_WORK,
  "block": {
    "type": [
      "image"
    ],
    "url": [
      "https://www.gstatic.com",
      //
      "https://m.ctrip.com/restapi/soa2/[0-9]+/GetChatMessages",
      "https://s.c-ctrip.com/bf.gif",
      "http://pic.c-ctrip.com/",
      //"https://webresource.c-ctrip.com/resaresonline/infosec/captcha/",
    ]
  }
}
