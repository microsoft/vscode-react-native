// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

const gulp = require("gulp");
const log = require('fancy-log');
const istanbul = require('gulp-istanbul');
const isparta = require('isparta');
const sourcemaps = require("gulp-sourcemaps");
const path = require("path");
const preprocess = require("gulp-preprocess");
const install = require("gulp-install");
const runSequence = require("run-sequence");
const ts = require("gulp-typescript");
const mocha = require("gulp-mocha");
const GulpExtras = require("./tools/gulp-extras");
const minimist = require("minimist");
const os = require("os");
const fs = require("fs");
const Q = require("q");
const es = require('event-stream');
const remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');
const execSync = require('child_process').execSync;
const nls = require('vscode-nls-dev');

const copyright = GulpExtras.checkCopyright;
const imports = GulpExtras.checkImports;
const executeCommand = GulpExtras.executeCommand;

const transifexApiHostname = 'www.transifex.com'
const transifexApiName = 'api';
const transifexApiToken = process.env.TRANSIFEX_API_TOKEN;
const transifexProjectName = 'vscode-extensions';
const transifexExtensionName = 'vscode-react-native';

const defaultLanguages = [
	{ id: 'zh-tw', folderName: 'cht', transifexId: 'zh-hant' },
	{ id: 'zh-cn', folderName: 'chs', transifexId: 'zh-hans' },
	{ id: 'ja', folderName: 'jpn' },
	{ id: 'ko', folderName: 'kor' },
	{ id: 'de', folderName: 'deu' },
	{ id: 'fr', folderName: 'fra' },
	{ id: 'es', folderName: 'esn' },
	{ id: 'ru', folderName: 'rus' },
    { id: 'it', folderName: 'ita' },

    // These language-pack languages are included for VS but excluded from the vscode package
    { id: 'cs', folderName: 'csy' },
    { id: 'tr', folderName: 'trk' },
    { id: 'pt-br', folderName: 'ptb', transifexId: 'pt_BR' },
    { id: 'pl', folderName: 'plk' }
];

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

// Configuring build task
var failOnError = true;
var buildNls = true;
function build(callback) {
    var tsProject = ts.createProject("tsconfig.json");
    var isProd = options.env === "production";
    var preprocessorContext = isProd ? { PROD: true } : { DEBUG: true };
    let gotError = false;
    log(`Building with preprocessor context: ${JSON.stringify(preprocessorContext)}`);
    var tsResult = tsProject.src()
        .pipe(preprocess({ context: preprocessorContext })) //To set environment variables in-line
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .on("error", function (e) {
            callback(e);
        });


        return tsResult.js
        .pipe(buildNls ? nls.rewriteLocalizeCalls() : es.through())
        .pipe(buildNls ? nls.createAdditionalLanguageFiles(defaultLanguages, 'i18n', '.') : es.through())
		.pipe(buildNls ? nls.bundleMetaDataFiles('vsmobile.vscode-react-native', '.') : es.through())
		.pipe(buildNls ? nls.bundleLanguageFiles() : es.through())
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '.' }))
        .pipe(gulp.dest(function (file) {
            return file.cwd;
        }))
        .once('error', () => {
            gotError = true;
        })
        .once('finish', () => {
            if (failOnError && gotError) {
                process.exit(1);
            }
        });
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

// Creates package.i18n.json files for all languages to {workspaceRoot}/i18n folder
gulp.task('add-i18n', function () {
    return gulp.src(['package.nls.json'])
        .pipe(nls.createAdditionalLanguageFiles(defaultLanguages, 'i18n'))
        .pipe(gulp.dest('.'));
});

// Gathers all strings to Transifex readable .xliff file for translating and pushes them to Transifex
gulp.task('transifex-push', ['build'], function () {
    return gulp.src(['package.nls.json', 'nls.metadata.header.json','nls.metadata.json'])
        .pipe(nls.createXlfFiles(transifexProjectName, transifexExtensionName))
        .pipe(nls.pushXlfFiles(transifexApiHostname, transifexApiName, transifexApiToken));
});

// Creates Transifex readable .xliff file and saves it locally
gulp.task('transifex-push-test', ['build'], function() {
    return gulp.src(['package.nls.json', 'nls.metadata.header.json','nls.metadata.json'])
        .pipe(nls.createXlfFiles(transifexProjectName, transifexExtensionName))
        .pipe(gulp.dest(path.join('..', `${transifexExtensionName}-push-test`)));
});

// Gets the files with localized strings from Transifex
gulp.task('transifex-pull', function () {
    return es.merge(defaultLanguages.map(function(language) {
        return nls.pullXlfFiles(transifexApiHostname, transifexApiName, transifexApiToken, language, [{ name: transifexExtensionName, project: transifexProjectName }]).
            pipe(gulp.dest(`../${transifexExtensionName}-localization/${language.folderName}`));
    }));
});

// Imports localization from raw localized Transifex strings to VS Code .i18n.json files
gulp.task('i18n-import', function() {
    return es.merge(defaultLanguages.map(function(language) {
        return gulp.src(`../${transifexExtensionName}-localization/${language.folderName}/**/*.xlf`)
            .pipe(nls.prepareJsonFiles())
            .pipe(gulp.dest(path.join('./i18n', language.folderName)));
    }));
});
