module.exports =

class Chapter {

  constructor(o){
    this.path = o.path || "";
    this.name = o.name || "";
    this.callable = o.callable || null;
    // chapter's argument is for chapter_%NAME%() call.
    // NOT same as Scenario's one.
    this.argument = o.argument || [];
  }

}
