module.exports = [
  [...Array(10).keys()].map((v) => {
    return {
      story: 'sample/many-cowork',
      isolated: false,
      premise: {
        value: v
      }
    }
  })
];
