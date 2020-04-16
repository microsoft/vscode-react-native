// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// This file is used by VS Code's default test runner to configure Mocha before the test run.

/* tslint:disable:no-var-keyword no-var-requires */
var testRunner = require("vscode/lib/testrunner");
/* tslint:enable:no-var-keyword no-var-requires */
import * as path from "path";

let mochaOption: any = {
    ui: "tdd",
    useColors: true,
    grep: "localizationContext",
    reporter: "cypress-multi-reporters",
    reporterOptions: {
        reporterEnabled: "spec, mocha-junit-reporter",
        mochaJunitReporterReporterOptions: {
            mochaFile: path.join(__dirname, "..", "LocalizationTests.xml"),
        },
    },
};

// Register Mocha options
testRunner.configure(mochaOption);

module.exports = testRunner;
