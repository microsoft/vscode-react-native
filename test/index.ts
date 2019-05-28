// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// This file is used by VS Code's default test runner to configure Mocha before the test run.

/* tslint:disable:no-var-keyword no-var-requires */
var testRunner = require("vscode/lib/testrunner");
/* tslint:enable:no-var-keyword no-var-requires */
import * as path from "path";

let mochaOptions: any = {
    ui: "tdd",
    useColors: true,
    invert: true,
    grep: "(debuggerContext|localizationContext)", // Do not run tests intended for the debuggerContext and localizationContext
    reporter: "mocha-multi-reporters",
    reporterOptions: {
        configFile: path.resolve(__dirname, "mochaReporterConfig.json"),
        mochaJunitReporterReporterOptions: {
            mochaFile: path.join(__dirname, "ExtensionTests.xml"),
        },
    },
};

// Register Mocha options
testRunner.configure(mochaOptions);

module.exports = testRunner;
