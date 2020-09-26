const nodemailer = require('nodemailer');

module.exports = class Mail {

  constructor(core){
    this.core = core;
    this.engine = nodemailer;
    this.host = {};

    if(!this.core.config.debug.send_report){
      this.core.log('Mail: debug.send_report is disabled.', 'info');
    }
  }

  /*
   * @see https://nodemailer.com/message/
   * ( host:string,
   *   param:object
   * ) -> Promise
   */
  async send(host, param){
    let p = param || {};

    this.validate_mail_host(host);

     /* Binds mailer host instance.
     */
    if(!this.host[host]){
      this.host[host] = this.engine.createTransport(this.core.config.mail[host].server);
    }

    let conf = this.core.config.mail[host];

    try{
      // defaults
      let o = {
        from: conf.from
      };
      // merged
      let m = FM.ob.merge(o, conf.default, p);
      // send
      return (await this.host[host].sendMail(m));
    }catch(e){
      this.core.logger.error(e);
    }
  }

  /* ( name:string
   *   template:string
   *   param:object
   * ) => Promise
   */
  async send_template_mail(name, template, param){
    let p = param || {};
    try{
      let path = [this.core.config.path.template, 'mail', template];
      this.validate_mail_host(name);
      p.type = param.type || this.core.config.mail[name].default.type;
      p[p.type] = await this.template.load(path, p.data || {});
      return await this.send(name, p);
    }catch(e){
      this.core.logger.error(e);
    }
  }

  /* send_report
   * ( String = template name
   *   Object = Parameters.
   * ) => Response
   */
  async send_report(template, param){
    if(!this.core.config.debug.send_report){
      return;
    }
    let h = "report";
    try{
      this.validate_mail_host(h);
      return await this.send_template_mail(h, template, param);
    }catch(e){
      this.core.logger.error(e);
    }
  }

  /*
   */
  async send_result_report(){
    if(!this.core.config.debug.send_report){
      return;
    }
    await this.send_report('default/report.result', {
      type: 'html',
      subject: 'GLOBAL: Execution Result',
      data: {
        result: this.result
      }
    });
  }

  /*
   */
  async send_dictation_report(stack){
    if(!this.core.config.debug.send_report){
      return;
    }
    await this.send_report('default/report.dictation', {
      type: 'html',
      subject: 'GLOBAL: Dictation Report',
      data: {
        stack: stack,
        count: {
          success: stack.filter((r) => { return r.status === true; }).length,
          failure: stack.filter((r) => { return r.status === false; }).length,
        }
      }
    });
  }


  /*
   */
  validate_mail_host(host){
   if(!(host in this.core.config.mail)){
      throw new Error("mail host '" + host + "' is not assigned in config. Check your mail.js in /burden/config/");
    }
  }


}
