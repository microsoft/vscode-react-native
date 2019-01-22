// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// This file is used by VS Code's default test runner to configure Mocha before the test run.

/* tslint:disable:no-var-keyword no-var-requires */
var testRunner = require("vscode/lib/testrunner");
/* tslint:enable:no-var-keyword no-var-requires */

let mochaOptions: any = {
    ui: "tdd",
    useColors: true,
    invert: true,
    grep: "(debuggerContext|localizationContext)", // Do not run tests intended for the debuggerContext and localizationContext
};

// Look for the env variable to decide wheter to use the TeamCity reporter or not
if (process.env.VSCODE_REACT_NATIVE_TEAMCITY_TEST) {
    mochaOptions.reporter = "mocha-teamcity-reporter";
}

// Register Mocha options
testRunner.configure(mochaOptions);

module.exports = testRunner;
