const Story = disc("class/Story");

module.exports = class extends Story {

  constructor(core){
    super(core);

    this.preface([
    ]);

    this.premise([
    ]);

    this.compose([
      "main",
      "output"
    ]);

  }


  /* play your way with sample chapter.
   */
  async chapter_main(param, prev){
    console.log("platform =>", this.core.space.device);
    return Object.assign({}, this.core.space.device);
  }

  async chapter_output(param, prev){
    return prev;
  }

}
