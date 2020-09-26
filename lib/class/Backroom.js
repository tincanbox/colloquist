
const {
  Worker, MessageChannel,
} = require('worker_threads');

/**
 *
 * @type {Backroom}
 */
module.exports = class Backroom {

  constructor(core){
    this.core = core;
  }

  /**
   *
   * @param option
   * @returns {Kuroko}
   */
  summon(option){
    let O = {};
    let ov = Object.assign({
      data: {},
      worker: {}
    }, option || {});
    O.worker = Object.assign({ eval: false }, ov.worker || {});
    O.worker.workerData = ov.data || {};

    let R = new Kuroko();

    R.worker = null;
    R.channel = new MessageChannel();
    R.run = (exec, arg) => {
      if(exec instanceof Function){
        exec = ''
          + 'const Worker = require("worker_threads");'
          + 'const {parentPort, workerData, MessageChannel} = Worker;'
          + '(async () => {'
            + 'try{ parentPort.postMessage('
              + 'await ((' + (exec.toString()) + ')'
                + '.apply(this, [workerData, ' + JSON.stringify(arg || {}) + '])))'
            + '}catch(e){ parentPort.postMessage(e) }'
          + '})();'
        ;
        O.worker.eval = true;
      }
      try{
        R.worker = new Worker(exec, O.worker);
        return new Promise((res, rej) => {
          R.worker.on('message', (r) => { return (r instanceof Error) ? rej(r) : res(r); });
          R.worker.on('error', rej);
          R.worker.on('exit', (code) => {
            if(code !== 0)
              rej(this.core.exception(Worker, `Kuroko failed your job... ${code}`, true));
          });
        });
      }catch(e){
        console.error("Kuroko Worker Error: ", e);
      }
    }

    return R;
  }

}

class Kuroko {}
