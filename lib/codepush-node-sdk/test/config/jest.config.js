module.exports = Object.assign({}, require("./jest.base"), {
  "transform": {
    ".(ts|tsx)": "<rootDir>/node_modules/ts-jest/preprocessor.js"
  },
  "testRegex": "test/.*-(test|spec).(ts|tsx)$",
  "moduleFileExtensions": [
    "ts",
    "tsx",
    "js",
    "json"
  ]
});
