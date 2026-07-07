const gulp = require("gulp");
const { series } = require("gulp");
const getFormatter = require("./formatter");
const getWebpackBundle = require("./webpackBundle");
const getCleaner = require("./cleaner");
const { runTypeScriptCompile } = require("./typescriptCli");
const nls = require("vscode-nls-dev");
const filter = require("gulp-filter");
const minimist = require("minimist");
const log = require("fancy-log");
const preprocess = require("gulp-preprocess");
const es = require("event-stream");

const knownOptions = {
    string: "env",
    default: { env: "production" },
};
const options = minimist(process.argv.slice(2), knownOptions);

const buildTask = gulp.series(getFormatter.lint, async function runBuild() {
    await build(true, true);
});

// Generates ./dist/nls.bundle.<language_id>.json from files in ./i18n/** *//<src_path>/<filename>.i18n.json
// Localized strings are read from these files at runtime.
const generateSrcLocBundle = () => {
    // Transpile the TS to JS, and let vscode-nls-dev scan the files for calls to localize.
    return runTypeScriptCompile().then(() =>
        streamToPromise(
            gulp
                .src(["src/**/*.js"], { base: ".", allowEmpty: true })
                .pipe(nls.createMetaDataFiles())
                .pipe(nls.createAdditionalLanguageFiles(defaultLanguages, "i18n"))
                .pipe(nls.bundleMetaDataFiles(fullExtensionName, "dist"))
                .pipe(nls.bundleLanguageFiles())
                .pipe(
                    filter([
                        "**/nls.bundle.*.json",
                        "**/nls.metadata.header.json",
                        "**/nls.metadata.json",
                        "!src/**",
                    ]),
                )
                .pipe(gulp.dest("dist")),
        ),
    );
};

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
    { id: "pl", folderName: "plk" },
];

/**
 * Whether we're running a nightly build.
 */
const isNightly = process.argv.includes("--nightly");

const fullExtensionName = isNightly
    ? "msjsdiag.vscode-react-native-preview"
    : "msjsdiag.vscode-react-native";

async function build(failOnError, buildNls) {
    const isProd = options.env === "production";
    const preprocessorContext = isProd ? { PROD: true } : { DEBUG: true };
    log(`Building with preprocessor context: ${JSON.stringify(preprocessorContext)}`);

    await runTypeScriptCompile();

    const stream = gulp
        .src(["src/**/*.js", "test/**/*.js"], { base: ".", allowEmpty: true })
        .pipe(preprocess({ context: preprocessorContext })) //To set environment variables in-line
        .pipe(buildNls ? nls.rewriteLocalizeCalls() : es.through())
        .pipe(
            buildNls
                ? nls.createAdditionalLanguageFiles(defaultLanguages, "i18n", ".")
                : es.through(),
        )
        .pipe(buildNls ? nls.bundleMetaDataFiles(fullExtensionName, ".") : es.through())
        .pipe(buildNls ? nls.bundleLanguageFiles() : es.through())
        .pipe(gulp.dest(file => file.cwd));

    try {
        await streamToPromise(stream);
    } catch (error) {
        if (failOnError) {
            throw error;
        }
    }
}

// TODO: The file property should point to the generated source (this implementation adds an extra folder to the path)
// We should also make sure that we always generate urls in all the path properties (We shouldn"t have \\s. This seems to
// be an issue on Windows platforms)
function runBuild(done) {
    build(true, true).then(() => done(), done);
}

function buildDev(done) {
    build(true, false).then(() => done(), done);
}

const buildProd = series(getCleaner.clean, getWebpackBundle.webpackBundle, generateSrcLocBundle);

function streamToPromise(stream) {
    return new Promise((resolve, reject) => {
        stream.once("error", reject);
        stream.once("finish", resolve);
    });
}

module.exports = {
    buildTask,
    buildDev,
    buildProd,
};
