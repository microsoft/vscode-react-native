const accountModels = require('./src/account/models');
const codepushModels = require('./src/codepush/models');

exports = Object.assign({},
  accountModels,
  codepushModels
);