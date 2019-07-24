const Story = disc("class/Story");
const fs = require('fs').promises;

module.exports = class extends Story {

  constructor(core){
    super(core);

    this.remini([
    ]);

    this.premise([
    ]);

    this.compose([
      "sample",
    ]);
  }

  async chapter_sample(){

    await this.page.goto('https://www.google.com');

    /* $P is injected (for all page) jQuery instance.
     */
    await FM.async.poll(async (rs) => {
      var l = await this.page.evaluate(() => {
        return $P('input[name="q"]').length > 0;
      });
      if(l) rs(true);
    })

    this.core.debug("here");
    await this.page.evaluate(() => {
      $P('input[name="q"]').val("kyoani");
    });

    await this.core.sleep(100);
    await this.page.evaluate(() => {
      $P('input[name="btnK"]').click();
    });

    await this.page.waitForNavigation();
  }

}
