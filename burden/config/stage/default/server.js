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

    /* string with an adjective `/` will be treated as the absolute-path.
     * /abs/to/your/dir
     *
     * string starting with non-`/` char will be treated as the relative-path from `burden`.
     * your/pub/in/burden
     */
    asset: [
      // ["static", "your/public/in/burden"]
    ],

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
