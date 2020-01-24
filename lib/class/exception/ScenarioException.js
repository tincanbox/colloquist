const ScenarioException = class extends Error {
  constructor(e, code){
    super(e);
    this.message = (e instanceof Error) ? e.message : (typeof e ===  "string" ? e : FM.vr.stringify(e));
    this.code = code || 100;
    this.detail = this.message;
  }
}

const ScenarioExceptionContinuable = class extends ScenarioException {
  constructor(e){
    super(e, 500);
  }
}

module.exports = { ScenarioException, ScenarioExceptionContinuable};
