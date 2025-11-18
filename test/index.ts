// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// This file is used by VS Code's default test runner to configure Mocha before the test run.

import * as path from "path";
import * as Mocha from "mocha";
import { glob } from "glob";
import NYCPackage from "nyc";

function setupCoverage(): NYCPackage {
    const NYC = require("nyc");
    const nyc = new NYC({
        cwd: path.join(__dirname, ".."),
        include: ["src/**/*.js"],
        exclude: ["test/**", ".vscode-test/**"],
        reporter: ["text", "html"],
        all: true,
        instrument: true,
        hookRequire: true,
        hookRunInContext: true,
        hookRunInThisContext: true,
    });

    nyc.reset();
    nyc.wrap();

    return nyc;
}

export async function run(): Promise<void> {
    const nyc = process.env.COVERAGE ? setupCoverage() : null;

    const mocha = new Mocha({
        ui: "tdd",
        grep: new RegExp("(debuggerContext|localizationContext)"), // Do not run tests intended for the debuggerContext and localizationContext
        reporter: "mocha-multi-reporters",
        reporterOptions: {
            reporterEnabled: "mocha-junit-reporter, mochawesome",
            mochaJunitReporterReporterOptions: {
                mochaFile: path.join(__dirname, "ExtensionTests.xml"),
            },
            mochawesomeReporterOptions: {
                reportDir: `${path.resolve(__dirname, "..")}/mochawesome-report`,
                reportFilename: "Rn-Test-Report",
                quiet: true,
            },
        },
        color: true,
    });

    mocha.invert();

    const testsRoot = __dirname;
    // Register Mocha options
    return glob("**/**.test.js", { cwd: testsRoot })
        .then((files: string[]) => {
            // Add files to the test suite
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            return new Promise<void>((resolve, reject) => {
                try {
                    mocha.run((failures: any) => {
                        if (failures > 0) {
                            reject(new Error(`${failures} tests failed.`));
                        } else {
                            resolve();
                        }
                    });
                } catch (err) {
                    reject(err);
                }
            });
        })
        .finally(() => {
            if (nyc) {
                nyc.writeCoverageFile();
                return nyc.report();
            }
            return void 0;
        });
}
