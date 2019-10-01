const Story = disc("class/Story");

module.exports = class extends Story {

  constructor(core){
    super(core);

    this.remini([
    ]);

    this.premise([
    ]);

    this.compose([
      "sample"
    ]);
  }


  /* play your way with sample chapter.
   */
  async chapter_sample(){

    await this.page.goto('https://news.yahoo.com/');

    /* Waits $P is injected.
     * $P is injected (for all page) jQuery instance.
     */
    await this.prepare();

    /* Waits and finds target elements.
     */
    await FM.async.poll(async (rs) => {
      var l = await this.page.evaluate(() => {
        return $P('.js-stream-content').length > 0;
      });
      if(l) rs(true);
    });

    /* DOM manipulations via $P.
     */
    var headlines = await this.page.evaluate(() => {
      var titles = [];
      $P('.js-stream-content').each((i, el) => {
        var wrap = $P(el);
        titles.push(wrap.find('h3').text());
      });
      return titles;
    });

    this.remember('headlines', headlines);
  }

}
