const { series } = require("gulp");
const cp = require("child_process");

const runPrettier = async fix => {
    const child = cp.fork(
        "./node_modules/@mixer/parallel-prettier/dist/index.js",
        [
            fix ? "--write" : "--list-different",
            "test/**/*.ts",
            "gulpfile.js",
            "*.md",
            "!CHANGELOG.md",
            "!test/smoke/**",
            "!src/**/*.d.ts",
            "!SECURITY.md",
        ],
        {
            stdio: "inherit",
        },
    );

    await new Promise((resolve, reject) => {
        child.on("exit", code => {
            code ? reject(`Prettier exited with code ${code}`) : resolve();
        });
    });
};

function formatPrettier(cb) {
    runPrettier(true);
    cb();
}

function lintPrettier(cb) {
    runPrettier(false);
    cb();
}

/**
 * @typedef {{color: boolean, fix: boolean}} OptionsT
 */

/**
 * @param {OptionsT} options_
 */
const runEslint = async options_ => {
    /** @type {OptionsT} */
    const options = Object.assign({ color: true, fix: false }, options_);

    const files = ["../src/**/*.ts"];

    const args = [
        ...(options.color ? ["--color"] : ["--no-color"]),
        ...(options.fix ? ["--fix"] : []),
        ...files,
    ];

    const child = cp.fork("../node_modules/eslint/bin/eslint.js", args, {
        stdio: "inherit",
        cwd: __dirname,
    });

    await new Promise((resolve, reject) => {
        child.on("exit", code => {
            code ? reject(`Eslint exited with code ${code}`) : resolve();
        });
    });
};

function formatEslint(cb) {
    runEslint({ fix: true });
    cb();
}

function lintEslint(cb) {
    runEslint({ fix: false });
    cb();
}

const lint = series(lintPrettier, lintEslint);

const format = series(formatPrettier, formatEslint);

module.exports = {
    formatPrettier,
    formatEslint,
    format,
    lintPrettier,
    lintEslint,
    lint: lint,
};
