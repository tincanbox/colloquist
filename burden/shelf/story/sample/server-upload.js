const Story = disc("class/Story");

/* Thsi is a very simple example of HTTP based file upload Story.
 * Use `npx colloquist server` and launch your default server.
 * And then, access to '/sample/run'. You can see HTML result of page/sample/run.njk .
 * You can request Story execution as a command. Try '/sample/server-upload'.
 */

module.exports = class extends Story {

  constructor(core){
    super(core);

    this.preface([
    ]);

    this.premise([
    ]);

    this.compose([
      "retrieve"
    ]);

  }


  /* play your way with sample chapter.
   */
  async chapter_retrieve(signal){

    var request = this.scene.argument.request;

    if(!request){
      throw new Error("Invalid Request");
    }

    var fls = {};
    for(var f in request.file){
      var file = request.file[f];
      fls[f] = fls[f] || {};
      ['name', 'type', 'size'].forEach((k) => {
        fls[f][k] = file[k];
      });
    }

    return fls;
  }

}
