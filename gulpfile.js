// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

var gulp = require("gulp");
var log = require('fancy-log');
var istanbul = require('gulp-istanbul');
var isparta = require('isparta');
var sourcemaps = require("gulp-sourcemaps");
var path = require("path");
var preprocess = require("gulp-preprocess");
var install = require("gulp-install");
var runSequence = require("run-sequence");
var ts = require("gulp-typescript");
var mocha = require("gulp-mocha");
var GulpExtras = require("./tools/gulp-extras");
var minimist = require("minimist");
var os = require("os");
var fs = require("fs");
var Q = require("q");
var remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');
var execSync = require('child_process').execSync;

var copyright = GulpExtras.checkCopyright;
var imports = GulpExtras.checkImports;
var executeCommand = GulpExtras.executeCommand;


var srcPath = "src";
var testPath = "test";

var sources = [
    srcPath,
    testPath,
].map(function (tsFolder) { return tsFolder + "/**/*.ts"; });

var knownOptions = {
    string: "env",
    default: { env: "production" }
};

var options = minimist(process.argv.slice(2), knownOptions);

var tsProject = ts.createProject("tsconfig.json");

// TODO: The file property should point to the generated source (this implementation adds an extra folder to the path)
// We should also make sure that we always generate urls in all the path properties (We shouldn't have \\s. This seems to
// be an issue on Windows platforms)
gulp.task("build", ["check-imports", "check-copyright"], build);

gulp.task("quick-build", build);

function build(callback) {
    var tsProject = ts.createProject("tsconfig.json");
    var isProd = options.env === "production";
    var preprocessorContext = isProd ? { PROD: true } : { DEBUG: true };
    log(`Building with preprocessor context: ${JSON.stringify(preprocessorContext)}`);
    return tsProject.src()
        .pipe(preprocess({ context: preprocessorContext })) //To set environment variables in-line
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .on("error", function (e) {
            callback(e);
        })
        .pipe(sourcemaps.write(".", {
            includeContent: false,
            sourceRoot: "."
        }))
        .pipe(gulp.dest(function (file) {
            return file.cwd;
        }));
}

gulp.task("watch", ["build"], function (cb) {
    log("Watching build sources...");
    return gulp.watch(sources, ["build"]);
});

gulp.task("default", function (callback) {
    runSequence("clean", "build", "tslint", callback);
});

var lintSources = [
    srcPath,
    testPath
].map(function (tsFolder) { return tsFolder + "/**/*.ts"; });
lintSources = lintSources.concat([
    "!src/typings/**",
    "!test/resources/sampleReactNative022Project/**"
]);

var libtslint = require("tslint");
var tslint = require("gulp-tslint");
gulp.task("tslint", function () {
    var program = libtslint.Linter.createProgram("./tsconfig.json");
    return gulp.src(lintSources, { base: "." })
        .pipe(tslint({
            formatter: "verbose",
            program: program
        }))
        .pipe(tslint.report());
});

function test() {
    // Check if arguments were passed
    if (options.pattern) {
        console.log("\nTesting cases that match pattern: " + options.pattern);
    } else {
        console.log("\nTesting cases that don't match pattern: extensionContext");
    }

    return gulp.src(["test/**/*.test.js", "!test/extension/**"])
        .pipe(mocha({
            ui: "tdd",
            useColors: true,
            invert: !options.pattern,
            grep: options.pattern || "extensionContext"
        }));
}

gulp.task("test", ["build", "tslint"], test);

gulp.task('coverage:instrument', function () {
    return gulp.src(["src/**/*.js", "!test/**"])
        .pipe(istanbul({
            // Use the isparta instrumenter (code coverage for ES6)
            instrumenter: isparta.Instrumenter,
            includeUntested: true
        }))
        // Force `require` to return covered files
        .pipe(istanbul.hookRequire());
});

gulp.task('coverage:report', function (done) {
    return gulp.src(
        ["src/**/*.js", "!test/**"],
        { read: false }
    )
        .pipe(istanbul.writeReports({
            reporters: ['json', 'text-summary']
        }));
});

gulp.task('coverage:remap', function () {
    return gulp.src('coverage/coverage-final.json')
        .pipe(remapIstanbul({
            reports: {
                'json': 'coverage/coverage.json',
                'html': 'coverage/html-report'
            }
        }));
});

gulp.task("test:coverage", function (done) {
    runSequence("quick-build", 'coverage:instrument',
        "test-no-build", 'coverage:report', 'coverage:remap', done);
});

gulp.task("test-no-build", test);

gulp.task("check-imports", function (cb) {
    return tsProject.src()
        .pipe(imports());
});

gulp.task("check-copyright", function (cb) {
    return gulp.src([
        "**/*.ts",
        "**/*.js",
        "!**/*.d.ts",
        "!coverage/**",
        "!node_modules/**",
        "!test/**/*.js",
        "!SampleApplication/**",
        "!test/resources/sampleReactNative022Project/**/*.js"
    ])
        .pipe(copyright());
});

gulp.task("watch-build-test", ["build", "build-test"], function () {
    return gulp.watch(sources, ["build", "build-test"]);
});

gulp.task("clean", function () {
    var del = require("del");
    var pathsToDelete = [
        "src/**/*.js",
        "src/**/*.js.map",
        "test/**/*.js",
        "test/**/*.js.map",
        "out/",
        "!test/resources/sampleReactNative022Project/**/*.js",
        ".vscode-test/"
    ]
    return del(pathsToDelete, { force: true });
});

gulp.task("package", function (callback) {
    var command = path.join(__dirname, "node_modules", ".bin", "vsce");
    var args = ["package"];
    executeCommand(command, args, callback);
});

gulp.task("release", ["build"], function () {
    var licenseFiles = ["LICENSE.txt", "ThirdPartyNotices.txt"];
    var backupFolder = path.resolve(path.join(os.tmpdir(), "vscode-react-native"));
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
            fs.writeFileSync("LICENSE.txt", fs.readFileSync("release/LICENSE.txt"));
            fs.writeFileSync("ThirdPartyNotices.txt", fs.readFileSync("release/ThirdPartyNotices.txt"));
        }).then(() => {
            console.log("Creating release package...");
            var deferred = Q.defer();
            // NOTE: vsce must see npm 3.X otherwise it will not correctly strip out dev dependencies.
            executeCommand("vsce", ["package"], function (arg) { if (arg) { deferred.reject(arg); } deferred.resolve() }, { cwd: path.resolve(__dirname) });
            return deferred.promise;
        }).finally(function () {
            /* restore backed up files */
            console.log("Restoring modified files...");
            licenseFiles.forEach(function (fileName) {
                fs.writeFileSync(path.join(__dirname, fileName), fs.readFileSync(path.join(backupFolder, fileName)));
            });
        });
});