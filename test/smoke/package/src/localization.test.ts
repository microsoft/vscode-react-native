// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Application } from "../../automation";
import { runVSCode, RNworkspacePath } from "./main";
import * as assert from "assert";
import * as path from "path";
import { sleep, findStringInFile } from "./helpers/utilities";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";

const startPackagerCommand = "Start Packager";
const packagerStartedCheck = "Запуск упаковщика";
export function setup() {
    describe("Localization test", () => {
        let app: Application;

        afterEach(async () => {
            if (app) {
                await app.stop();
            }
        });

        it("Test localization", async function () {
            app = await runVSCode(RNworkspacePath, "ru");
            SmokeTestLogger.info("Localization test: Starting packager");
            await app.workbench.quickaccess.runCommand(startPackagerCommand);
            await sleep(10 * 1000);
            if (process.env.REACT_NATIVE_TOOLS_LOGS_DIR) {
                SmokeTestLogger.info(`Localization test: Search for '${packagerStartedCheck}' string output`);
                const found = findStringInFile(path.join(process.env.REACT_NATIVE_TOOLS_LOGS_DIR, SmokeTestsConstants.ReactNativeLogFileName), packagerStartedCheck);
                if (found) {
                    SmokeTestLogger.success(`Localization test: Output found`);
                } else {
                    assert.fail("Localized RU string is not found in log file");
                }
            } else {
                assert.fail("REACT_NATIVE_TOOLS_LOGS_DIR is not defined");
            }
        });
    });
}
