const accountModels = require('./src/account/models');
const codepushModels = require('./src/codepush/models');
const analyticsModels = require('./src/analytics/models');
const distributeModels = require('./src/distribute/models');
const buildModels = require('./src/build/models');
const crashModels = require('./src/crash/models');
const testModels = require('./src/test/models');
const exportModels = require('./src/export/models');
const pushModels = require('./src/push/models');

exports = Object.assign({}, 
  accountModels, 
  codepushModels, 
  analyticsModels, 
  distributeModels, 
  buildModels, 
  crashModels, 
  testModels, 
  exportModels, 
  pushModels
);