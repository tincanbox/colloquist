//const fs = require('fs').promises;
//const path = require('path');

const {
  Worker, parentPort, workerData, MessageChannel,
} = require('worker_threads');


module.exports = class Backroom {

  constructor(core){
    this.core = core;
  }

  pop(option){
    let O = Object.assign({
      eval: false
    }, option || {});

    let R = new Kuroko();

    R.worker = null;
    R.port = parentPort;
    R.channel = new MessageChannel();
    R.run = (exec, arg) => {
      if(exec instanceof Function){
        let l = [
          'const Worker = require("worker_threads");',
          'const {parentPort, workerData, MessageChannel} = Worker;',
          'let channel = new MessageChannel();'
        ];
        exec = l.join("")
          + '(' + (exec.toString()) + ')'
          + '.apply(this, [parentPort, workerData, ' + JSON.stringify(arg) + ']);'
          + ';'
        ;
        O.eval = true;
      }
      R.worker = new Worker(exec, O);
      return new Promise((res, rej) => {
        R.worker.on('message', res);
        R.worker.on('error', rej);
        R.worker.on('exit', (code) => {
          if(code !== 0)
            rej(this.core.exception(Worker, `Kuroko failed your job... ${code}`, true));
        });
      })
    }

    return R;
  }

}

class Kuroko {}
