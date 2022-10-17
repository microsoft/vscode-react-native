const gulp = require("gulp");
const log = require("fancy-log");
const path = require("path");
const nls = require("vscode-nls-dev");
const es = require("event-stream");
const minimist = require("minimist");

const getBuilder = require(appRoot + "/gulp_scripts/builder");

/**
 * Whether we're running a nightly build.
 */
const isNightly = process.argv.includes("--nightly");

const fullExtensionName = isNightly
    ? "msjsdiag.vscode-react-native-preview"
    : "msjsdiag.vscode-react-native";

const translationProjectName = "vscode-extensions";

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

function addi18n() {
    return gulp
        .src(["package.nls.json"])
        .pipe(nls.createAdditionalLanguageFiles(defaultLanguages, "i18n"))
        .pipe(gulp.dest("."));
}

const translationsExport = gulp.series(getBuilder.buildTask, function runTranslationExport() {
    return gulp
        .src(["package.nls.json", "nls.metadata.header.json", "nls.metadata.json"])
        .pipe(nls.createXlfFiles(translationProjectName, fullExtensionName))
        .pipe(gulp.dest(path.join("..", `${translationProjectName}-localization-export`)));
});

const translationImport = gulp.series(done => {
    var options = minimist(process.argv.slice(2), {
        string: "location",
        default: {
            location: "../vscode-translations-import",
        },
    });
    es.merge(
        defaultLanguages.map(language => {
            let id = language.transifexId || language.id;
            log(path.join(options.location, id, "vscode-extensions", `${fullExtensionName}.xlf`));
            return gulp
                .src(
                    path.join(
                        options.location,
                        id,
                        "vscode-extensions",
                        `${fullExtensionName}.xlf`,
                    ),
                )
                .pipe(nls.prepareJsonFiles())
                .pipe(gulp.dest(path.join("./i18n", language.folderName)));
        }),
    ).pipe(
        es.wait(() => {
            done();
        }),
    );
}, addi18n);

module.exports = {
    addi18n,
    translationImport,
    translationsExport,
};
