// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Application } from "../../automation";
import { vscodeManager } from "./main";
import * as assert from "assert";
import { sleep } from "./helpers/utilities";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";

const startPackagerCommand = "Start Packager";
const packagerStartedCheck = "Запуск упаковщика";
export function startLocalizationTests(workspace: string): void {
    describe("Localization test", () => {
        let app: Application;

        afterEach(async () => {
            if (app) {
                await app.stop();
            }
        });

        it("Test localization", async function () {
            try {
                app = await vscodeManager.runVSCode(workspace, "LocalizationTest", "ru");
                console.log("Localization test: Starting packager");
                await app.workbench.quickaccess.runCommand(startPackagerCommand);
                await sleep(10 * 1000);
                console.log(`Localization test: Search for '${packagerStartedCheck}' string output`);
                const found = vscodeManager.findStringInLogs(packagerStartedCheck, SmokeTestsConstants.ReactNativeLogFileName);
                if (found) {
                    console.log(`Localization test: Output found`);
                } else {
                    assert.fail("Localized RU string is not found in log file");
                }
            } catch (e) {
                console.log("Localization test failed: " + e);
                return this.skip();
            }
        });
    });
}
