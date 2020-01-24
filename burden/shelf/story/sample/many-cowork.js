const Story = disc("class/Story");

module.exports = class extends Story {

  constructor(core){
    super(core);

    this.preface([
    ]);

    this.premise([
    ]);

    this.compose([
      "sample"
    ]);

  }


  /* play your way with sample chapter.
   */
  async chapter_sample(param, prev){

    await this.scene.commence();

    let b = await this.page.evaluate(() => {
      return 3;
    });

    console.log(b);

  }

}
