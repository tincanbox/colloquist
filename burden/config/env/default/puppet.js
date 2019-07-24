/* Configurations for Puppeteer
 */
module.exports = {
  "headless": false,
  "viewport": null,
  "display": {
    "width": false,
    "height": false
  },
  "max_concurrent_work": 2,
  "block": {
    "type": [
      // Puppeteer request type: like 'image'
    ],
    "url": [
      // Regex pattern list
    ]
  }
}
