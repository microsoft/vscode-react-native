// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// This file is used by VS Code's default test runner to configure Mocha before the test run.

import * as path from "path";
import * as Mocha from "mocha";
import NYCPackage from "nyc";

async function loadGlob(): Promise<any> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require("glob");
    } catch (e) {
        if (e && /ERR_REQUIRE_ESM/.test(String(e))) {
            return await import("glob");
        }
        throw e;
    }
}

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

    // Provide harmless stubs for Mocha BDD hooks if some non-target test files
    // (e.g. smoke tests) get loaded indirectly before Mocha initialization.
    const hookNames = ["before", "after", "beforeEach", "afterEach"]; // minimal surface
    for (const hn of hookNames) {
        if (!(global as any)[hn]) {
            (global as any)[hn] = () => {
                /* stub */
            };
        }
    }

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
    const globPkg = await loadGlob();
    const getTestFiles = (pattern: string, cwd: string): Promise<string[]> => {
        const candidateFns: any[] = [];
        if (globPkg) {
            if (typeof globPkg.glob === "function") candidateFns.push(globPkg.glob);
            if (typeof globPkg === "function") candidateFns.push(globPkg);
        }
        for (const fn of candidateFns) {
            try {
                const res = fn(pattern, { cwd });
                if (res && typeof res.then === "function") {
                    return res as Promise<string[]>;
                }
            } catch (_e) {
                // ignore and fallback to callback path
            }
        }
        return new Promise<string[]>((resolve, reject) => {
            const cb = (err: Error | null, files: string[]) => (err ? reject(err) : resolve(files));
            for (const fn of candidateFns) {
                try {
                    fn(pattern, { cwd }, cb);
                    return; // rely on callback
                } catch (_e) {
                    // try next
                }
            }
            reject(new Error("Unsupported glob package shape"));
        });
    };

    // Exclude smoke test bundle and localization driver; only run unit/integration tests here
    return getTestFiles("extension/**/*.test.js", testsRoot)
        .then(files => files.filter(f => !/[/\\]exponent[/\\]/i.test(f)))
        .then(files => {
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));
            return new Promise<void>((resolve, reject) => {
                try {
                    mocha.run(failures => {
                        if (failures > 0) {
                            reject(new Error(`${failures} tests failed.`));
                        } else {
                            resolve();
                        }
                    });
                } catch (err) {
                    reject(err as Error);
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
