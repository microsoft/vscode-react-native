/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

var child_process = require('child_process');
var gulp = require('gulp');
var log = require('gulp-util').log;
var mocha = require('gulp-mocha');
var sourcemaps = require('gulp-sourcemaps');
var os = require('os');
var path = require('path');
var runSequence = require("run-sequence");
var ts = require('gulp-typescript');

var srcPath = 'src';
var outPath = 'out';

var sources = [
    srcPath,
].map(function (tsFolder) { return tsFolder + '/**/*.ts'; })
    .concat(['test/*.ts']);


gulp.task('build', function (callback) {
    var compileCommand = "node ./node_modules/vscode/bin/compile -p .";
    console.log("Executing: " + compileCommand);
    child_process.exec(compileCommand, function (err, stdout, stderr) {
        console.log(stdout);
        console.error(stderr);
        callback(err);
    });
});

// We should eventually fix and use this build. Until we do that, we'll keep it as "old_build"
gulp.task('old_build', function () {
    var tsProject = ts.createProject('src/tsconfig.json');
    return tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(ts(tsProject))
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: 'file:///' + __dirname + '/' + srcPath + '/' }))
        .pipe(gulp.dest(outPath));
});

gulp.task('watch', ['build'], function (cb) {
    log('Watching build sources...');
    return gulp.watch(sources, ['build']);
});

gulp.task('default', function (callback) {
    runSequence("clean", "build", "tslint", callback);
});

var lintSources = [
    srcPath,
].map(function (tsFolder) { return tsFolder + '/**/*.ts'; });
lintSources = lintSources.concat([
    '!src/typings/**'
]);

var tslint = require('gulp-tslint');
gulp.task('tslint', function () {
    return gulp.src(lintSources, { base: '.' })
        .pipe(tslint())
        .pipe(tslint.report('verbose'));
});

function test() {
    throw new Error('No tests yet');
}

gulp.task('build-test', ['build'], test);
gulp.task('test', test);

gulp.task('watch-build-test', ['build', 'build-test'], function () {
    return gulp.watch(sources, ['build', 'build-test']);
});

gulp.task("clean", function () {
    var del = require("del");
    return del([outPath + "/**"], { force: true });
});