// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

var child_process = require('child_process');
var gulp = require('gulp');
var log = require('gulp-util').log;
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

// TODO: The file property should point to the generated source (this implementation adds an extra folder to the path)
// We should also make sure that we always generate urls in all the path properties (We shouldn't have \\s. This seems to
// be an issue on Windows platforms)
gulp.task('build', ['checkImports'], function () {
    var tsProject = ts.createProject('tsconfig.json');
    return tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(ts(tsProject))
        .pipe(sourcemaps.write('.', {
            includeContent: false,
            sourceRoot: function (file) {
                return path.relative(path.dirname(file.path), __dirname + '/src');
            }
        }))
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
    throw new Error('To run tests, open the extension in VS Code and hit F5 with the "Launch Tests" configuration. Alternatively, on Mac OS, you can run "npm test" on the command line.');
}

gulp.task('build-test', ['build'], test);
gulp.task('test', test);

gulp.task('checkImports', function (cb) {
    var checkProcess = child_process.fork(path.join(__dirname, "tools", "checkCasing.js"),
        {
            cwd: path.resolve(__dirname, "src"),
            stdio: "inherit"
        });
    checkProcess.on("error", cb);
    checkProcess.on("exit", function (code, signal) {
        if (code || signal) {
            cb(new Error("Mismatches found in import casing"));
        } else {
            cb();
        }
    });
});

gulp.task('watch-build-test', ['build', 'build-test'], function () {
    return gulp.watch(sources, ['build', 'build-test']);
});

gulp.task("clean", function () {
    var del = require("del");
    var pathsToDelete = [
        outPath,
        ".vscode-test"
    ].map(function (folder) {
        return folder + "/**";
    });
    return del(pathsToDelete, { force: true });
});
