// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

const gulp = require("gulp");
const cp = require("child_process");
const path = require("path");
const ncp = require("ncp");
const rimraf = require("rimraf");

const CODE_REPO_VERSION = "1.39.2";
const CODE_REPO_URL = "https://github.com/microsoft/vscode.git";
const SMOKE_TESTS_PACKAGE_FOLDER = path.join(__dirname, "package");
const CODE_FOLDER_NAME = "vscode";
const CODE_ROOT = path.join(__dirname, CODE_FOLDER_NAME);
const CODE_SMOKE_TESTS_FOLDER = path.join(CODE_ROOT, "test", "smoke");

function prepareEnvironment() {
    console.log(`*** Removing old VS Code repo directory: ${CODE_ROOT}`);
    rimraf.sync(CODE_ROOT);
    downloadVSCodeRepository();
    rimraf.sync(CODE_SMOKE_TESTS_FOLDER);
}

function downloadVSCodeRepository() {
    console.log(`*** Downloading VS Code ${CODE_REPO_VERSION} repo into directory: ${CODE_ROOT}`);
    cp.execSync(`git clone --branch ${CODE_REPO_VERSION} ${CODE_REPO_URL}`, { cwd: __dirname, stdio: "inherit" });
}

gulp.task("prepare-environment", (done) => {
    prepareEnvironment();
    console.log(`*** Copying smoke tests package ${SMOKE_TESTS_PACKAGE_FOLDER} into directory: ${CODE_SMOKE_TESTS_FOLDER}`);
    ncp(SMOKE_TESTS_PACKAGE_FOLDER, CODE_SMOKE_TESTS_FOLDER, (err) => {
        if (err) {
            console.error(`Couldn't copy smoke tests from ${SMOKE_TESTS_PACKAGE_FOLDER} package into ${CODE_SMOKE_TESTS_FOLDER}: ${err}`);
        }
        done();
    });
});


