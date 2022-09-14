const gulp = require("gulp");
const { series } = require("gulp");
const log = require("fancy-log");
const getBuilder = require("../gulp_scripts/builder");
const getTester = require("../gulp_scripts/tester");
const srcPath = "src";
const testPath = "test";
const sources = [srcPath, testPath].map(tsFolder => tsFolder + "/**/*.ts");

const watch = series(getBuilder.buildTask, function runWatch() {
    log("Watching build sources...");
    return gulp.watch(sources, gulp.series(getBuilder.buildTask));
});

const watchBuildTest = gulp.series(getBuilder.buildTask, getTester.testTask, function runWatch() {
    return gulp.watch(sources, gulp.series(getBuilder.buildTask, getTester.testTask));
});

module.exports = {
    watch,
    watchBuildTest,
};
