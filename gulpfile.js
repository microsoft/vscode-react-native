// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/*
How to develop:
run in terminal `npx gulp develop`, wait for it to complete build process, then use `Launch Extension` debug option
this will start webpack in watch mode - it will automaticlly recompile files on every change. However, vscode does not support hot-reload
so you still have to restart debugging every time you change something (do not restart gulp task though).

It is too problematic to setup preLaunchTask with webpack watch mode. I suggest above workflow as it is much more straightforward and simple
---

What is left to be done:
I've done nothing to correct unit-tests and did not change smoke-test configs. Everything related to CI **will break**
I think we need to add separate build process for tests
(we do not have to add webpack for that. plain typescript compilation with `outDir` should be good enough)

I did not test our npm releases and I have no idea what will happen to them

I did not test resulting vsix package

During discussion we failed to come to agreement about what things should be left in root `package.json` file and which should be moved away
---

Suggestions:
Moving all files that are only required for build process to separate folder
(package.nls.*.json, template-package.json, CHANGELOG.md, resources)

Removing useless files
(.vscodeignore, prepareBuild.bat, tools)

Creating separate tsconfig files for `test` and `src` folders. This implies removing root `tsconfig.json` file

Moving smoke-test folder to a different location and naming it in a more conventional way (e2e, gui)
---

Notes:
There is a problem with `src/debugger/appWorker.ts`. I think it is a webpack bug.
*/

const gulp = require("gulp");
const vscodeTest = require("vscode-test");
const cp = require("child_process");
const { promisify } = require("util");
const fs = require("fs/promises");
const gulpTs = require("gulp-typescript");
const vscodeNls = require("vscode-nls-dev");
const gulpFilter = require("gulp-filter");
const { Writable } = require("stream");
const path = require("path");
const util = require("util");
const glob = require("glob");
const copyFile = require("ncp"); // #todo> please remove this dependency later
const stream = require("stream");
const readline = require("readline");

const execute = util.promisify(cp.exec);

const isNightly = process.argv.includes("--nightly");

const packageContext = {
    get version() {
        if (!isNightly) {
            return "1.9.2";
        }

        const date = new Date(
            new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
        );

        return [
            date.getFullYear(),
            date.getMonth() + 1,
            `${date.getDate()}${String(date.getHours()).padStart(2, "0")}`,
        ].join(".");
    },
    extensionName: isNightly ? "vscode-react-native-preview" : "vscode-react-native",
    displayName: isNightly ? "React Native Tools (Preview)" : "React Native Tools",

    ...(isNightly && { preview: true }),
};

const config = {
    dest: path.resolve("./dist"),
    languages: [
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
    ],
};

gulp.task("build", build);
gulp.task("default", build);

gulp.task("release", async () => {
    await build();
    await execute("vsce package", { cwd: config.dest });
});

gulp.task("develop", async () => {
    await buildTranslation();
    await buildRequiredFiles();
    await new Promise((resolve, reject) => {
        const webpackProcess = cp.exec(
            `npx webpack --config webpack.config.js --mode development  --devtool source-map --watch --output-path ${config.dest} --info-verbosity verbose`,
        );
        webpackProcess.stdout.pipe(process.stdout);
        webpackProcess.stdout.once("data", arg => {
            if (/webpack .* compiled with .* error/.test(arg) || /webpack.*failed/.test(arg)) {
                // error happened during build process
                console.error("<<< webpack failed with an error >>>");

                webpackProcess.kill();
                reject();
            } else {
                resolve();
            }
        });
    });
});

async function build() {
    await fs.rm(config.dest, { recursive: true, force: true });

    // 'vscode-nls-dev' can't generate all required translation with it's webpack loader
    await buildTranslation();
    await buildRequiredFiles();
    await new Promise((resolve, reject) => {
        const webpackProcess = cp.exec(
            `npx webpack --mode production --output-path ${config.dest} --config webpack.config.js`,
        );
        webpackProcess.stdout.pipe(process.stdout);
        webpackProcess.once("exit", () => {
            webpackProcess.exitCode === 0 ? resolve() : reject();
        });
    });
}

async function buildRequiredFiles() {
    const requiredFiles = [
        // "release/LICENSE.txt",
        // "release/ThirdPartyNotices.txt",
        "README.md",
        "CHANGELOG.md",
        "resources",
        ...glob.sync("./package.nls*"),
    ];

    fs.copyFile("release/LICENSE.txt", "dist/LICENSE.txt");
    fs.copyFile("release/ThirdPartyNotices.txt", "dist/ThirdPartyNotices.txt");
    await Promise.all(requiredFiles.map(it => copyFile(it, `${config.dest}/${it}`)));
    await fs.writeFile(
        `${config.dest}/package.json`,
        JSON.stringify(Object.assign(require("./template-package.json"), packageContext)),
    );
}

// Do not try to replace it with webpack-loader - such edit will require full rewrite of 'vscode-nls-dev'
async function buildTranslation() {
    {
        // disables useless logs
        let stdWrite = process.stdout.write;
        var stopOuput = () => (process.stdout.write = () => {});
        var resumeOutput = () => (process.stdout.write = stdWrite);
    }

    const tsProject = gulpTs.createProject("tsconfig.json");

    stopOuput();

    await new Promise(resolve => {
        tsProject
            .src()
            .pipe(vscodeNls.createMetaDataFiles())
            .pipe(vscodeNls.createAdditionalLanguageFiles(config.languages, "i18n"))
            .pipe(vscodeNls.bundleMetaDataFiles(packageContext.extensionName, config.dest))
            .pipe(vscodeNls.bundleLanguageFiles())
            .pipe(
                gulpFilter([
                    "**/nls.bundle.*.json",
                    "**/nls.metadata.header.json",
                    "**/nls.metadata.json",
                    "!src/**",
                ]),
            )
            .pipe(gulp.dest(config.dest))
            .once("end", resolve);
    });
    resumeOutput();
}

/**
 * @typedef {{color: boolean, fix: boolean}} OptionsT
 */
/**
 * @param {OptionsT} options_
 */
async function runEslint(options_) {
    /** @type {OptionsT} */
    const options = Object.assign({ color: true, fix: false }, options_);

    const files = ["src/**/*.ts"];

    const args = [
        ...(options.color ? ["--color"] : ["--no-color"]),
        ...(options.fix ? ["--fix"] : []),
        ...files,
    ];

    const child = cp.fork("npx eslint", args, {
        stdio: "inherit",
        cwd: __dirname,
    });

    await new Promise((resolve, reject) => {
        child.on("exit", code => {
            code ? reject(`Eslint exited with code ${code}`) : resolve();
        });
    });
}
