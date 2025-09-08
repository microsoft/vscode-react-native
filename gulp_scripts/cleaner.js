const del = require("del");
const GulpExtras = require("../tools/gulp-extras");

async function clean() {
    const pathsToDelete = [
        "src/**/*.js",
        "src/**/*.js.map",
        "test/**/*.js",
        "test/**/*.js.map",
        "out/",
        "dist",
        "!test/resources/sampleReactNativeProject/**/*.js",
        "!test/resources/newVersionReactNativeProject/**/*.js",
        ".vscode-test/",
        "nls.*.json",
        "!test/smoke/**/*",
    ];

    const TIMEOUT_MS = 5000;

    return await GulpExtras.withTimeout(
        del(pathsToDelete, { force: true }),
        TIMEOUT_MS,
        {
            onTimeout: () => console.log("Timeout for clean up, will try on next step, but may cause other failures."),
            fallbackValue: [],
        }
    );
}

module.exports = {
    clean,
};
