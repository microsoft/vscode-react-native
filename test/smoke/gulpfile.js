// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

const gulp = require("gulp");
const cp = require("child_process");
const path = require("path");
const ncp = require("ncp");
const rimraf = require("rimraf");

const CODE_REPO_VERSION = "1.58.1";
const CODE_REPO_URL = "https://github.com/microsoft/vscode.git";
const SMOKE_TESTS_PACKAGE_FOLDER = path.join(__dirname, "package");
const SMOKE_TESTS_AUTOMATION_FOLDER = path.join(__dirname, "automation");
const CODE_FOLDER_NAME = "vscode";
const CODE_ROOT = path.join(__dirname, CODE_FOLDER_NAME);
const CODE_SMOKE_TESTS_FOLDER = path.join(CODE_ROOT, "test", "smoke");
const CODE_AUTOMATION_FOLDER = path.join(CODE_ROOT, "test", "automation");

const runPrettier = (onlyStaged, fix, callback) => {
    const child = cp.fork(
        "../../node_modules/@mixer/parallel-prettier/dist/index.js",
        [fix ? "--write" : "--list-different", "package/src/**/*.ts", "gulpfile.js"],
        { stdio: "inherit" },
    );

    child.on("exit", code => (code ? callback(`Prettier exited with code ${code}`) : callback()));
};

const runEslint = (fix, callback) => {
    let args = ["--color", "package/src/**/*.ts", "automation/src/**/*.ts"];
    if (fix) {
        args.push("--fix");
    }
    const child = cp.fork("../../node_modules/eslint/bin/eslint.js", args, {
        stdio: "inherit",
        cwd: __dirname,
    });

    child.on("exit", code => (code ? callback(`Eslint exited with code ${code}`) : callback()));
};

gulp.task("format:prettier", callback => runPrettier(false, true, callback));
gulp.task("format:eslint", callback => runEslint(true, callback));
gulp.task("format", gulp.series("format:prettier", "format:eslint"));

gulp.task("lint:prettier", callback => runPrettier(false, false, callback));
gulp.task("lint:eslint", callback => runEslint(false, callback));
gulp.task("lint", gulp.parallel("lint:prettier", "lint:eslint"));

gulp.task("prepare-environment", done => {
    console.log(`*** Removing old VS Code repo directory: ${CODE_ROOT}`);
    rimraf.sync(CODE_ROOT);
    done();
});

gulp.task("download-vscode-repo", done => {
    console.log(`*** Downloading VS Code ${CODE_REPO_VERSION} repo into directory: ${CODE_ROOT}`);
    cp.execSync(`git clone --branch ${CODE_REPO_VERSION} ${CODE_REPO_URL}`, {
        cwd: __dirname,
        stdio: "inherit",
    });
    done();
});

gulp.task("remove-vscode-smoke-tests", done => {
    console.log(`*** Removing VS Code repo smoke tests directory: ${CODE_SMOKE_TESTS_FOLDER}`);
    rimraf.sync(CODE_SMOKE_TESTS_FOLDER);
    console.log(`*** Removing VS Code repo smoke tests directory: ${CODE_AUTOMATION_FOLDER}`);
    rimraf.sync(CODE_AUTOMATION_FOLDER);
    done();
});

gulp.task(
    "prepare-smoke-tests",
    gulp.series(
        "lint",
        "prepare-environment",
        "download-vscode-repo",
        "remove-vscode-smoke-tests",
        function copyPackage(done) {
            console.log(
                `*** Copying smoke tests package ${SMOKE_TESTS_PACKAGE_FOLDER} into directory: ${CODE_SMOKE_TESTS_FOLDER}`,
            );
            ncp(SMOKE_TESTS_PACKAGE_FOLDER, CODE_SMOKE_TESTS_FOLDER, err => {
                if (err) {
                    console.error(
                        `Couldn't copy smoke tests from ${SMOKE_TESTS_PACKAGE_FOLDER} package into ${CODE_SMOKE_TESTS_FOLDER}: ${err}`,
                    );
                }
                console.log(
                    `*** Copying smoke tests package ${SMOKE_TESTS_AUTOMATION_FOLDER} into directory: ${CODE_AUTOMATION_FOLDER}`,
                );
                ncp(SMOKE_TESTS_AUTOMATION_FOLDER, CODE_AUTOMATION_FOLDER, err => {
                    if (err) {
                        console.error(
                            `Couldn't copy smoke tests from ${SMOKE_TESTS_AUTOMATION_FOLDER} package into ${CODE_AUTOMATION_FOLDER}: ${err}`,
                        );
                    }
                    done();
                });
            });
        },
    ),
);
