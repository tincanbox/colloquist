module.exports = {

  /* Maximum level of logger engine.
   */
  level: 'all',

  /* Rotation configulation.
   */
  rotation: {
    size: '20m',
    term: '14d',
    count: {
      dictation: 100
    }
  }

}
