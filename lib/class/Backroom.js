//const fs = require('fs').promises;
//const path = require('path');

const {
  Worker, MessageChannel,
} = require('worker_threads');


module.exports = class Backroom {

  constructor(core){
    this.core = core;
  }

  pop(option){
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
        let l = [
          'const Worker = require("worker_threads");',
          'const {parentPort, workerData, MessageChannel} = Worker;',
        ];
        exec = '(async () => { try{ '
          + l.join("")
          + 'parentPort.postMessage('
            + 'await ('
              + '(' + (exec.toString()) + ')'
              + '.apply(this, [workerData, ' + JSON.stringify(arg || {}) + '])'
            + ')'
          + ');'
          + '}catch(e){ console.error(e); return e; } })();'
        ;
        O.worker.eval = true;
      }
      R.worker = new Worker(exec, O.worker);
      return new Promise((res, rej) => {
        R.worker.on('message', res);
        R.worker.on('error', rej);
        R.worker.on('exit', (code) => {
          if(code !== 0)
            rej(this.core.exception(Worker, `Kuroko failed your job... ${code}`, true));
        });
      });
    }

    return R;
  }

}

class Kuroko {}
