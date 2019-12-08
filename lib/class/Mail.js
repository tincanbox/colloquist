const fsp = require('fs').promises;
const nodemailer = require('nodemailer');

module.exports = class Mail {

  constructor(core){
    this.core = core;
    this.engine = nodemailer;
    this.host = {};
  }

  /*
   * @see https://nodemailer.com/message/
   * ( host:string,
   *   param:object
   * ) -> Promise
   */
  async send(host, param){
    var p = param || {};

    this.validate_mail_host(host);

     /* Binds mailer host instance.
     */
    if(!this.host[host]){
      this.host[host] = this.engine.createTransport(this.core.config.mail[host].server);
    }

    var conf = this.core.config.mail[host];

    try{
      // defaults
      var o = {
        from: conf.from
      };
      // merged
      var m = FM.ob.merge(o, conf.default, p);
      // send
      var res = await this.host[host].sendMail(m);
      return res;
    }catch(e){
      this.log_error("mailer.sendMail failed");
      this.log_error(e);
    }
  }

  /* ( name:string
   *   template:string
   *   param:object
   * ) => Promise
   */
  async send_template_mail(name, template, param){
    var p = param || {};
    try{
      var path = [this.core.config.path.template, 'mail', template + '.ejs'];
      this.validate_mail_host(name);
      p.type = param.type || this.core.config.mail[name].default.type;
      p[p.type] = await this.template.load(path, p.data || {});
      return await this.send(name, p);
    }catch(e){
      this.log_error(e);
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
    var h = "report";
    try{
      this.validate_mail_host(h);
      return await this.send_template_mail(h, template, param);
    }catch(e){
      this.log_error(e);
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
      subject: 'GLOBAL: Excecution Result',
      data: {
        result: this.result
      }
    });
  }

  /*
   */
  async send_dictation_report(){
    if(!this.core.config.debug.send_report){
      return;
    }
    var buf = await fsp.readFile(this.logger.active_dictation_log);
    var log = buf.toString();
    var spl = log.split("\n").filter((e) => { return e.length > 0; });
    await this.send_report('default/report.dictation', {
      type: 'html',
      subject: 'GLOBAL: Dictation Report',
      data: {
        dictation_list: spl.map((r) => {
          return JSON.parse(r);
        })
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
