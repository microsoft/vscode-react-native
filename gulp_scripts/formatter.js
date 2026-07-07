const { series } = require("gulp");
const cp = require("child_process");
const log = require("fancy-log");

const runPrettier = async fix => {
    const child = cp.fork(
        "./node_modules/@mixer/parallel-prettier/dist/index.js",
        [
            fix ? "--write" : "--list-different",
            "test/**/*.ts",
            "gulpfile.js",
            "*.md",
            "!CHANGELOG.md",
            "!test/smoke/node_modules/**",
            "!test/smoke/out/**",
            "!test/smoke/.vscode-test/**",
            "!src/**/*.d.ts",
            "!SECURITY.md",
            "!test/smoke/resources/sampleReactNativeProject/**",
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
    runPrettier(true).then(() => cb(), cb);
}

function lintPrettier(cb) {
    runPrettier(false).then(() => cb(), cb);
}

/**
 * @typedef {{color: boolean, fix: boolean}} OptionsT
 */

/**
 * @param {OptionsT} options_
 */
const runEslint = async options_ => {
    if (!hasTypeScriptJavaScriptApi()) {
        log(
            "Skipping ESLint because the installed TypeScript package does not expose the legacy JavaScript API.",
        );
        return;
    }

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
    runEslint({ fix: true }).then(() => cb(), cb);
}

function lintEslint(cb) {
    runEslint({ fix: false }).then(() => cb(), cb);
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

function hasTypeScriptJavaScriptApi() {
    try {
        require.resolve("typescript");
        return true;
    } catch (error) {
        if (error && error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED") {
            return false;
        }

        throw error;
    }
}
