const gulp = require("gulp");
const log = require("fancy-log");
const minimist = require("minimist");
const path = require("path");
const vscodeTest = require("@vscode/test-electron");
const getBuilder = require("./builder");
const getFormatter = require("./formatter");

const vscodeVersionForTests = "stable";

const knownOptions = {
    string: "env",
    default: { env: "production" },
};
const options = minimist(process.argv.slice(2), knownOptions);

async function test(inspectCodeCoverage = false) {
    // Check if arguments were passed
    // if (options.pattern) {
    //     log(`\nTesting cases that match pattern: ${options.pattern}`);
    // } else {
    //     log(`\nTesting cases that don't match pattern: extensionContext|localizationContext`);
    // }

    if (options != null) {
        log(`\nArgument passed.`);
    } else {
        log(`\nArgument not passed.`);
    }

    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = __dirname;

        // The path to the extension test runner script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, "test", "index");
        console.log(extensionTestsPath);
        // Download VS Code, unzip it and run the integration test

        const testOptions = {
            extensionDevelopmentPath,
            extensionTestsPath,
            version: vscodeVersionForTests,
        };

        // Activate inspection of code coverage with unit tests
        if (inspectCodeCoverage) {
            testOptions.extensionTestsEnv = {
                COVERAGE: "true",
            };
        }

        await vscodeTest.runTests(testOptions);
    } catch (err) {
        console.error(err);
        console.error("Failed to run tests");
        process.exit(1);
    }
}

const testTask = gulp.series(getBuilder.buildTask, getFormatter.lint, test);

const testCoverage = gulp.series(gulp.series(getBuilder.buildDev), async function () {
    await test(true);
});

module.exports = {
    test,
    testTask,
    testCoverage,
};
