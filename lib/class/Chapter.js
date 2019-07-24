module.exports =

class Chapter {

  constructor(o){
    this.path = o.path || "";
    this.name = o.name || "";
    this.callable = o.callable || null;
    this.param = o.param || [];
  }

}
