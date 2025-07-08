// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";

import { runTests } from "@vscode/test-electron";

async function launchTests() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, "..");

        // The path to the extension test runner script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, "index");

        // Path to the test project sample
        // Passed to launchArgs and vscode will be opened at this path
        const projectPath = path.resolve(__dirname, "resources", "newVersionReactNativeProject");

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            version: "stable",
            launchArgs: [projectPath],
        });
    } catch (err) {
        console.error(err);
        console.error("Failed to run tests");
        process.exit(1);
    }
    process.exit();
}

launchTests();
