// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Mocha from "mocha";

export function run(): Promise<void> {
    const mocha = new Mocha ({
        ui: "tdd",
        grep: RegExp("localizationContext"),
        reporter: "mocha-multi-reporters",
        reporterOptions: {
            reporterEnabled: "spec, mocha-junit-reporter",
            mochaJunitReporterReporterOptions: {
                mochaFile: path.join(__dirname, "..", "LocalizationTests.xml"),
            },
        },
        color: true,
    });

    // Register Mocha options
    return new Promise((resolve, reject) => {
        mocha.addFile(path.resolve(__dirname, "localization.test.js"));

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
}

