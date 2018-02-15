module.exports = {
  "rootDir": "../../",
  "setupFiles": [
    "babel-polyfill"
  ],
  "testRegex": "test/.*-(test|spec).js$",
  "testPathIgnorePatterns": [
    "/node_modules/"
  ],
  "moduleFileExtensions": [
    "js",
    "json"
  ],
  "moduleNameMapper": {
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": "<rootDir>/test/mocks/file-mock.js"
  }
};
