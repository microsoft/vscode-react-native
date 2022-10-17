const del = require("del");

function clean() {
    const pathsToDelete = [
        "src/**/*.js",
        "src/**/*.js.map",
        "test/**/*.js",
        "test/**/*.js.map",
        "out/",
        "dist",
        "!test/resources/sampleReactNativeProject/**/*.js",
        ".vscode-test/",
        "nls.*.json",
        "!test/smoke/**/*",
    ];
    return del(pathsToDelete, { force: true });
}

module.exports = {
    clean,
};
