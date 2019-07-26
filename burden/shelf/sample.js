const Story = disc("class/Story");

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

    await this.page.goto('https://news.google.com/?hl=en-US');
    await this.prepare();

    /* $P is injected (for all page) jQuery instance.
     */
    await FM.async.poll(async (rs) => {
      var l = await this.page.evaluate(() => {
        return $P('c-wiz').length > 0;
      });
      if(l) rs(true);
    })

    var headlines = await this.page.evaluate(() => {
      var titles = [];
      $P('c-wiz > div > div[jscontroller]').each((el) => {
        var wrap = $P(el);
        titles.push(wrap.find('article > h3').text());
      });
      return titles;
    });
    console.log(headlines);

    await FM.async.sleep(100);
    await this.page.evaluate(() => {
      $P('input[name="btnK"]').click();
    });

    await this.page.waitForNavigation();
  }

}
