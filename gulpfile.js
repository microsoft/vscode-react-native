// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

var gulp = require('gulp');
var log = require('gulp-util').log;
var sourcemaps = require('gulp-sourcemaps');
var path = require('path');
var preprocess = require('gulp-preprocess');
var runSequence = require("run-sequence");
var ts = require('gulp-typescript');
var mocha = require('gulp-mocha');
var GulpExtras = require("./tools/gulp-extras");
var minimist = require('minimist');
var os = require("os");
var fs = require("fs");
var Q = require("q");

var copyright = GulpExtras.checkCopyright;
var imports = GulpExtras.checkImports;
var executeCommand = GulpExtras.executeCommand;

var srcPath = 'src';
var outPath = 'out';

var sources = [
    srcPath,
].map(function (tsFolder) { return tsFolder + '/**/*.ts'; })
    .concat(['test/*.ts']);

var knownOptions = {
    string: 'env',
    default: { env: 'production' }
};

var options = minimist(process.argv.slice(2), knownOptions);

// TODO: The file property should point to the generated source (this implementation adds an extra folder to the path)
// We should also make sure that we always generate urls in all the path properties (We shouldn't have \\s. This seems to
// be an issue on Windows platforms)
gulp.task('build', ["check-imports", "check-copyright"], function (callback) {
    var tsProject = ts.createProject('tsconfig.json');
    var isProd = options.env === 'production';
    var preprocessorContext = isProd ? { PROD: true } : { DEBUG: true };
    log(`Building with preprocessor context: ${JSON.stringify(preprocessorContext)}`);
    return tsProject.src()
        .pipe(preprocess({ context: preprocessorContext })) //To set environment variables in-line
        .pipe(sourcemaps.init())
        .pipe(ts(tsProject))
        .on('error', function (e) {
            callback(e);
        })
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
    '!src/typings/**',
    '!src/test/resources/sampleReactNative022Project/**',
]);

var tslint = require('gulp-tslint');
gulp.task('tslint', function () {
    return gulp.src(lintSources, { base: '.' })
        .pipe(tslint())
        .pipe(tslint.report('verbose'));
});

function test() {
    // Check if arguments were passed
    if (options.pattern) {
        console.log("\nTesting cases that match pattern: " + options.pattern);
    } else {
        console.log("\nTesting cases that don't match pattern: extensionContext");
    }

    return gulp.src(['out/test/**/*.test.js', '!out/test/extension/**'])
        .pipe(mocha({
            ui: 'tdd',
            useColors: true,
            invert: !options.pattern,
            grep: options.pattern || "extensionContext"
        }));
}

gulp.task('test', ['build', 'tslint'], test);
gulp.task('test-no-build', test);

gulp.task('check-imports', function (cb) {
    var tsProject = ts.createProject('tsconfig.json');
    return tsProject.src()
        .pipe(imports());
});

gulp.task('check-copyright', function (cb) {
    return gulp.src([
        "**/*.ts",
        "**/*.js",
        "!**/*.d.ts",
        "!node_modules/**",
        "!SampleApplication/**",
        "!SampleExponentApplication/**",
        "!src/test/resources/sampleReactNative022Project/**/*.js",
    ])
        .pipe(copyright());
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

gulp.task("package", function (callback) {
    var command = path.join(__dirname, "node_modules", ".bin", "vsce");
    var args = ["package"];
    executeCommand(command, args, callback);
});

gulp.task("release", ["build"], function () {
    var licenseFiles = ["LICENSE.txt", "ThirdPartyNotices.txt"];
    var backupFolder = path.resolve(path.join(os.tmpdir(), 'vscode-react-native'));
    if (!fs.existsSync(backupFolder)) {
        fs.mkdirSync(backupFolder);
    }

    return Q({})
        .then(function () {
            /* back up LICENSE.txt, ThirdPartyNotices.txt, README.md */
            console.log("Backing up license files to " + backupFolder + "...");
            licenseFiles.forEach(function (fileName) {
                fs.writeFileSync(path.join(backupFolder, fileName), fs.readFileSync(fileName));
            });

            /* copy over the release package license files */
            console.log("Preparing license files for release...");
            fs.writeFileSync('LICENSE.txt', fs.readFileSync('release/LICENSE.txt'));
            fs.writeFileSync('ThirdPartyNotices.txt', fs.readFileSync('release/ThirdPartyNotices.txt'));
        }).then(()=>{
            console.log("Creating release package...");
            var deferred = Q.defer();
            // NOTE: vsce must see npm 3.X otherwise it will not correctly strip out dev dependencies.
            executeCommand('vsce', ['package'], function (arg) { if (arg) { deferred.reject(arg);} deferred.resolve()} , {cwd: path.resolve(__dirname)});
            return deferred.promise;
        }).finally(function () {
            /* restore backed up files */
            console.log("Restoring modified files...");
            licenseFiles.forEach(function (fileName) {
                fs.writeFileSync(path.join(__dirname, fileName), fs.readFileSync(path.join(backupFolder, fileName)));
            });
        });
})
