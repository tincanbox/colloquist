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

    let tgt = ['foo', 'bar', 'baz'];
    let res = [];
    let handler = Promise.all(tgt.map((ver) => {

      return new Promise((resolve, reject) => {

        // Generates handler object.
        let w = this.core.backroom.pop({
          workerData: ver
        });

        // Main loop.
        w.run((port, data) => {
          let ret = [];
          // Do Your Heavy Things.
          for(let i = 0; i < 100; i++){
            ret.push(data + ":" + i);
          }
          // then send a message.
          port.postMessage(ret);
        }).then((r) => {
          res = res.concat(r);
          setTimeout(() => {
            resolve(r);
          }, 0);
        }).catch((e) => {
          reject(e);
        });

      });

    }));

    handler.then(() => {
      console.log("RESULT", res);
    });

  }

}
