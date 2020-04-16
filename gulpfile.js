// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

const gulp = require("gulp");
const log = require("fancy-log");
const istanbul = require("gulp-istanbul");
const isparta = require("isparta");
const sourcemaps = require("gulp-sourcemaps");
const path = require("path");
const preprocess = require("gulp-preprocess");
const ts = require("gulp-typescript");
const mocha = require("gulp-mocha");
const GulpExtras = require("./tools/gulp-extras");
const minimist = require("minimist");
const os = require("os");
const fs = require("fs");
const Q = require("q");
const es = require("event-stream");
const remapIstanbul = require("remap-istanbul/lib/gulpRemapIstanbul");
const nls = require("vscode-nls-dev");
const libtslint = require("tslint");
const tslint = require("gulp-tslint");

const copyright = GulpExtras.checkCopyright;
const imports = GulpExtras.checkImports;
const executeCommand = GulpExtras.executeCommand;

const translationProjectName  = "vscode-extensions";
const translationExtensionName  = "vscode-react-native";
const defaultLanguages = [
    { id: "zh-tw", folderName: "cht", transifexId: "zh-hant" },
    { id: "zh-cn", folderName: "chs", transifexId: "zh-hans" },
    { id: "ja", folderName: "jpn" },
    { id: "ko", folderName: "kor" },
    { id: "de", folderName: "deu" },
    { id: "fr", folderName: "fra" },
    { id: "es", folderName: "esn" },
    { id: "ru", folderName: "rus" },
    { id: "it", folderName: "ita" },

    // These language-pack languages are included for VS but excluded from the vscode package
    { id: "cs", folderName: "csy" },
    { id: "tr", folderName: "trk" },
    { id: "pt-br", folderName: "ptb", transifexId: "pt-BR" },
    { id: "pl", folderName: "plk" }
];

const srcPath = "src";
const testPath = "test";

const sources = [srcPath, testPath].map((tsFolder) => tsFolder + "/**/*.ts");

const knownOptions = {
    string: "env",
    default: { env: "production" }
};

const options = minimist(process.argv.slice(2), knownOptions);

let lintSources = [srcPath, testPath].map((tsFolder) => tsFolder + "/**/*.ts");
lintSources = lintSources.concat([
    "!src/typings/**",
    "!test/resources/sampleReactNative022Project/**",
    "!test/smoke/**",
    "!/SmokeTestLogs/**"
]);

function build(failOnError, buildNls) {
    const tsProject = ts.createProject("tsconfig.json");
    const isProd = options.env === "production";
    const preprocessorContext = isProd ? { PROD: true } : { DEBUG: true };
    let gotError = false;
    log(`Building with preprocessor context: ${JSON.stringify(preprocessorContext)}`);
    const tsResult = tsProject.src()
        .pipe(preprocess({ context: preprocessorContext })) //To set environment variables in-line
        .pipe(sourcemaps.init())
        .pipe(tsProject());

    return tsResult.js
        .pipe(buildNls ? nls.rewriteLocalizeCalls() : es.through())
        .pipe(buildNls ? nls.createAdditionalLanguageFiles(defaultLanguages, "i18n", ".") : es.through())
        .pipe(buildNls ? nls.bundleMetaDataFiles("msjsdiag.vscode-react-native", ".") : es.through())
        .pipe(buildNls ? nls.bundleLanguageFiles() : es.through())
        .pipe(sourcemaps.write(".", { includeContent: false, sourceRoot: "." }))
        .pipe(gulp.dest((file) => file.cwd))
        .once("error", () => {
            gotError = true;
        })
        .once("finish", () => {
            if (failOnError && gotError) {
                process.exit(1);
            }
        });
}

function test() {
    // Check if arguments were passed
    if (options.pattern) {
        log(`\nTesting cases that match pattern: ${options.pattern}`);
    } else {
        log("\nTesting cases that don't match pattern: extensionContext|localizationContext");
    }

    const testResultsPath = path.join(__dirname, "test", "DebuggerTests.xml");
    process.env.MOCHA_FILE = testResultsPath;
    return gulp.src(["test/**/*.test.js", "!test/extension/**"])
        .pipe(mocha({
            ui: "tdd",
            useColors: true,
            invert: !options.pattern,
            grep: options.pattern || "(extensionContext|localizationContext)",
            reporter: "cypress-multi-reporters",
            reporterOptions: {
                configFile: path.resolve("test/mochaReporterConfig.json"),
            },
        }));
}

gulp.task("check-imports", () => {
    const tsProject = ts.createProject("tsconfig.json");
    return tsProject.src()
        .pipe(imports());
});

gulp.task("check-copyright", () => {
    return gulp.src([
        "**/*.ts",
        "**/*.js",
        "!**/*.d.ts",
        "!coverage/**",
        "!node_modules/**",
        "!test/**/*.js",
        "!SampleApplication/**",
        "!test/resources/sampleReactNative022Project/**/*.js",
        "!test/smoke/package/node_modules/**",
        "!test/smoke/automation/node_modules/**",
        "!test/smoke/resources/**",
        "!test/smoke/vscode/**"
    ])
        .pipe(copyright());
});

gulp.task("tslint", () => {
    const program = libtslint.Linter.createProgram("./tsconfig.json");
    return gulp.src(lintSources, { base: "." })
        .pipe(tslint({
            formatter: "verbose",
            program: program
        }))
        .pipe(tslint.report());
});

// TODO: The file property should point to the generated source (this implementation adds an extra folder to the path)
// We should also make sure that we always generate urls in all the path properties (We shouldn"t have \\s. This seems to
// be an issue on Windows platforms)
gulp.task("build", gulp.series("check-imports", "check-copyright", "tslint", function runBuild(done) {
    build(true, true)
        .once("finish", () => {
            done();
        });
}));

gulp.task("build-dev", gulp.series("check-imports", "check-copyright", function runBuild(done) {
    build(false, false)
        .once("finish", () => {
            done();
        });
}));

gulp.task("quick-build", gulp.series("build-dev"));

gulp.task("watch", gulp.series("build", function runWatch() {
    log("Watching build sources...");
    return gulp.watch(sources, gulp.series("build"));
}));

gulp.task("clean", () => {
    const del = require("del");
    const pathsToDelete = [
        "src/**/*.js",
        "src/**/*.js.map",
        "test/**/*.js",
        "test/**/*.js.map",
        "out/",
        "!test/resources/sampleReactNative022Project/**/*.js",
        ".vscode-test/",
        "nls.*.json",
        "!test/smoke/**/*.js",
        "!test/smoke/**/*.js.map",
    ]
    return del(pathsToDelete, { force: true });
});

gulp.task("default", gulp.series("clean", "build"));

gulp.task("test", gulp.series("build", "tslint", test));

gulp.task("coverage:instrument", () => {
    return gulp.src(["src/**/*.js", "!test/**"])
        .pipe(istanbul({
            // Use the isparta instrumenter (code coverage for ES6)
            instrumenter: isparta.Instrumenter,
            includeUntested: true
        }))
        // Force `require` to return covered files
        .pipe(istanbul.hookRequire());
});

gulp.task("coverage:report", () => {
    return gulp.src(
        ["src/**/*.js", "!test/**"],
        { read: false }
    )
    .pipe(istanbul.writeReports({
        reporters: ["json", "text-summary"]
    }));
});

gulp.task("coverage:remap", () => {
    return gulp.src("coverage/coverage-final.json")
        .pipe(remapIstanbul({
            reports: {
                "json": "coverage/coverage.json",
                "html": "coverage/html-report"
            }
        }));
});

gulp.task("test-no-build", test);

gulp.task("test:coverage", gulp.series("quick-build", "coverage:instrument", "test-no-build", "coverage:report", "coverage:remap"));

gulp.task("watch-build-test", gulp.series("build", "test", function runWatch() {
    return gulp.watch(sources, gulp.series("build", "test"));
}));

gulp.task("package", (callback) => {
    const command = path.join(__dirname, "node_modules", ".bin", "vsce");
    const args = ["package"];
    executeCommand(command, args, callback);
});

gulp.task("release", gulp.series("build", function prepareLicenses() {
    const licenseFiles = ["LICENSE.txt", "ThirdPartyNotices.txt"];
    const backupFolder = path.resolve(path.join(os.tmpdir(), "vscode-react-native"));
    if (!fs.existsSync(backupFolder)) {
        fs.mkdirSync(backupFolder);
    }

    return Q({})
        .then(() => {
            /* back up LICENSE.txt, ThirdPartyNotices.txt, README.md */
            log("Backing up license files to " + backupFolder + "...");
            licenseFiles.forEach((fileName) => {
                fs.writeFileSync(path.join(backupFolder, fileName), fs.readFileSync(fileName));
            });

            /* copy over the release package license files */
            log("Preparing license files for release...");
            fs.writeFileSync("LICENSE.txt", fs.readFileSync("release/LICENSE.txt"));
            fs.writeFileSync("ThirdPartyNotices.txt", fs.readFileSync("release/ThirdPartyNotices.txt"));
        }).then(() => {
            log("Creating release package...");
            var deferred = Q.defer();
            // NOTE: vsce must see npm 3.X otherwise it will not correctly strip out dev dependencies.
            executeCommand("vsce", ["package"], (arg) => { if (arg) { deferred.reject(arg); } deferred.resolve() }, { cwd: path.resolve(__dirname) });
            return deferred.promise;
        }).finally(() => {
            /* restore backed up files */
            log("Restoring modified files...");
            licenseFiles.forEach((fileName) => {
                fs.writeFileSync(path.join(__dirname, fileName), fs.readFileSync(path.join(backupFolder, fileName)));
            });
        });
}));

// Creates package.i18n.json files for all languages from {workspaceRoot}/i18n folder into project root
gulp.task("add-i18n", () => {
    return gulp.src(["package.nls.json"])
        .pipe(nls.createAdditionalLanguageFiles(defaultLanguages, "i18n"))
        .pipe(gulp.dest("."))
});

// Creates MLCP readable .xliff file and saves it locally
gulp.task("translations-export", gulp.series("build", function runTranslationExport() {
    return gulp.src(["package.nls.json", "nls.metadata.header.json", "nls.metadata.json"])
        .pipe(nls.createXlfFiles(translationProjectName, translationExtensionName))
        .pipe(gulp.dest(path.join("..", `${translationProjectName}-localization-export`)));
}));

// Imports localization from raw localized MLCP strings to VS Code .i18n.json files
gulp.task("translations-import", (done) => {
    var options = minimist(process.argv.slice(2), {
        string: "location",
        default: {
            location: "../vscode-translations-import"
        }
    });
    es.merge(defaultLanguages.map((language) => {
        let id = language.transifexId || language.id;
        log(path.join(options.location, id, 'vscode-extensions', `${translationExtensionName}.xlf`));
        return gulp.src(path.join(options.location, id, 'vscode-extensions', `${translationExtensionName}.xlf`))
            .pipe(nls.prepareJsonFiles())
            .pipe(gulp.dest(path.join("./i18n", language.folderName)));
    }))
        .pipe(es.wait(() => {
            done();
        }));
});
