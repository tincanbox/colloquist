const os = require('os');

const ScenarioException = class extends Error {
  constructor(e, code){
    super(e);
    this.message = (e instanceof Error) ? e.message : (typeof e ===  "string" ? e : FM.vr.stringify(e));
    Object.defineProperty(this, "original", {
      enumerable: false,
      writable: false,
      value: e
    });
    this.code = code || 100;
    this.detail = this.message;
    this.trace = ((e instanceof Error) ? e.stack : this.stack).split(os.EOL).map(e => e.trim());
  }
}

const ScenarioExceptionContinuable = class extends ScenarioException {
  constructor(e){
    super(e, 500);
  }
}

module.exports = { ScenarioException, ScenarioExceptionContinuable};
