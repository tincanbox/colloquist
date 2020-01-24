module.exports = {
  /* Uses express as main server.
   * http://expressjs.com/en/5x/api.html#router
   *
   * You can separate the server configurations define like `default`.
   */
  default: {
    /*
     */
    port: 9000,

    session: {
      secret: 'YOURSECRET',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: true }
    },

    /*
     */
    router: {
      mergeParams: true
    },

    /* Adaptor for the shelf/server/default instance.
     */
    prepare: async function(/* core, engine, handler, config */){
      /* Do Your Things. */
      return {
        "something": 1234
      };
    }
  }
};
