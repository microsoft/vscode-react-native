// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// This file is used by VS Code's default test runner to configure Mocha before the test run.

import * as path from "path";
import * as Mocha from "mocha";
// Use require to access CommonJS shape reliably across glob versions
// eslint-disable-next-line @typescript-eslint/no-var-requires
const globPkg = require("glob");
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
    // Cross-version glob: supports glob v11 Promise API and glob v7 callback API
    const getTestFiles = (pattern: string, cwd: string): Promise<string[]> => {
        const globFn = globPkg && typeof globPkg.glob === "function" ? globPkg.glob : null;
        // Try Promise API first (glob >= 11)
        if (globFn) {
            const res = globFn(pattern, { cwd });
            if (res && typeof res.then === "function") {
                return res as Promise<string[]>;
            }
        }
        // Fallback to callback API (glob <= 7)
        return new Promise<string[]>((resolve, reject) => {
            try {
                if (typeof globPkg === "function") {
                    (
                        globPkg as unknown as (
                            p: string,
                            opts: { cwd: string },
                            cb: (err: Error | null, files: string[]) => void,
                        ) => void
                    )(pattern, { cwd }, (err, files) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(files);
                        }
                    });
                } else if (globPkg && typeof globPkg.glob === "function") {
                    // Some versions expose callback via globPkg.glob as well
                    globPkg.glob(pattern, { cwd }, (err: Error | null, files: string[]) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(files);
                        }
                    });
                } else {
                    reject(new Error("Unsupported glob package shape"));
                }
            } catch (e) {
                reject(e as Error);
            }
        });
    };

    // Register Mocha options
    return getTestFiles("**/**.test.js", testsRoot)
        .then((files: string[]) => {
            // Add files to the test suite
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            return new Promise<void>((resolve, reject) => {
                try {
                    // Run the mocha test
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
