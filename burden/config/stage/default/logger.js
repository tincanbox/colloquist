module.exports = {

  /* Maximum level of logger engine.
   */
  level: 'all',

  output: ['console', 'file', /* 'database:mongodb' */],

  /* Rotation configulation.
   */
  rotation: {
    size: '20m',
    term: '14d',
    count: {
      dictation: 100
    }
  },

}
