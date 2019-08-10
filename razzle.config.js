'use strict';

module.exports = {
  modify: config => {
    delete config.externals;
    return config;
  },
  plugins: [{
    name: 'typescript',
    options: {
      forkTsChecker: {
        tslint: null
      }
    }
  }],
};
