// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

//@ts-expect-error import not yet compiled module
import { Application } from "../../automation";
import { vscodeManager } from "./main";
import * as assert from "assert";
import { sleep } from "./helpers/utilities";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import TestProject from "./helpers/testProject";
import AutomationHelper from "./helpers/AutomationHelper";

const startPackagerCommand = "Start Packager";
const packagerStartedCheck = "Запуск упаковщика";
export function startLocalizationTests(project: TestProject): void {
    describe("Localization test", () => {
        let app: Application;
        let automationHelper: AutomationHelper;

        async function initApp(
            workspaceOrFolder: string,
            sessionName?: string,
            locale?: string,
        ): Promise<Application> {
            app = await vscodeManager.runVSCode(workspaceOrFolder, sessionName, locale);
            automationHelper = new AutomationHelper(app);
            return app;
        }

        afterEach(async () => {
            SmokeTestLogger.info("Dispose all ...");
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await automationHelper.runCommandWithRetry(SmokeTestsConstants.stopPackagerCommand);
                await sleep(3000);
                await app.stop();
            }
        });

        it("Test localization", async function () {
            try {
                app = await initApp(project.workspaceDirectory, "LocalizationTest", "ru");
                SmokeTestLogger.info("Localization test: Starting packager");
                await automationHelper.runCommandWithRetry(startPackagerCommand);
                await sleep(10 * 1000);
                SmokeTestLogger.info(
                    `Localization test: Search for '${packagerStartedCheck}' string output`,
                );
                const found = vscodeManager.findStringInLogs(
                    packagerStartedCheck,
                    SmokeTestsConstants.ReactNativeLogFileName,
                );
                if (found) {
                    SmokeTestLogger.success(`Localization test: Output found`);
                } else {
                    assert.fail("Localized RU string is not found in log file");
                }
            } catch (e) {
                SmokeTestLogger.error("Localization test failed: " + e);
                return this.skip();
            }
        });
    });
}
