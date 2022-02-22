// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import { Application } from "../../automation";
import * as assert from "assert";
import * as rimraf from "rimraf";
import * as fs from "fs";
import { join } from "path";
import { vscodeManager } from "./main";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { testApplicationSetupManager } from "./main";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import TestProject from "./helpers/testProject";
import { sleep, waitUntil } from "./helpers/utilities";
import AutomationHelper from "./helpers/AutomationHelper";

// Time for Debugging Via Dynamic Configs Test before it reaches timeout
const debuggingViaDynamicConfigsTestTime = 10 * 60 * 1000;

const packagerStartedCheck = "Packager started";

export function startDebuggingViaDynamicConfigsTests(project: TestProject): void {
    describe("Debugging via dynamic configs test", () => {
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

        async function disposeAll() {
            try {
                SmokeTestLogger.info("Dispose all ...");
                if (app) {
                    SmokeTestLogger.info("Stopping React Native packager ...");
                    await automationHelper.runCommandWithRetry(
                        SmokeTestsConstants.stopPackagerCommand,
                    );
                    await sleep(3000);
                    SmokeTestLogger.info("Stopping application ...");
                    await app.stop();
                }
            } catch (error) {
                SmokeTestLogger.error("Error while disposeAll:");
                SmokeTestLogger.error(error);
            }
        }

        before(async () => {
            const launchJsonPath = join(project.vsCodeConfigPath, "launch.json");
            if (fs.existsSync(launchJsonPath)) {
                SmokeTestLogger.info(
                    `*** Debugging via dynamic configs test: deleting "launch.json" file ${launchJsonPath}`,
                );
                rimraf.sync(launchJsonPath);
            }
        });

        after(async () => {
            testApplicationSetupManager.copyDebuggingConfigurationsToProject(project);
        });

        afterEach(disposeAll);

        async function findPackagerStartedStrInLogFile() {
            const condition = () =>
                vscodeManager.findStringInLogs(
                    packagerStartedCheck,
                    SmokeTestsConstants.ReactNativeLogFileName,
                );

            return waitUntil(condition, 30000, 5000);
        }

        it("Start 'Debug Android' dynamic config", async function () {
            this.timeout(debuggingViaDynamicConfigsTestTime);
            app = await initApp(
                project.workspaceDirectory,
                "Start 'Debug Android' dynamic config test",
            );
            // We need to wait a bit to let the extension activate
            await sleep(15 * 1000);
            SmokeTestLogger.info(
                "Start 'Debug Android' dynamic config test: open React Native Tools dynamic debug configurations",
            );
            await automationHelper.openDynamicDebugScenariosWithRetry();
            SmokeTestLogger.info(
                "Start 'Debug Android' dynamic config test: select and run 'Debug Android' debug config",
            );
            await app.workbench.quickinput.selectQuickInputElement(2);
            SmokeTestLogger.info(
                "Start 'Debug Android' dynamic config test: waiting for packager started",
            );
            const packagerStarted = await findPackagerStartedStrInLogFile();
            if (!packagerStarted) {
                assert.fail("Packager started string is not found");
                return;
            }
            SmokeTestLogger.success(
                "Start 'Debug Android' dynamic config test: Packager started string is found'",
            );
            await automationHelper.disconnectFromDebuggerWithRetry();
            SmokeTestLogger.info("Start 'Debug Android' dynamic config test: Debugging is stopped");
        });

        it("Start 'Attach to packager' dynamic config", async function () {
            this.timeout(debuggingViaDynamicConfigsTestTime);
            this.retries(3);
            app = await initApp(
                project.workspaceDirectory,
                "Start 'Attach to packager' dynamic config test",
            );
            // We need to wait a bit to let the extension activate
            await sleep(15 * 1000);
            SmokeTestLogger.info(
                "Start 'Attach to packager' dynamic config test: open React Native Tools dynamic debug configurations",
            );
            await automationHelper.openDynamicDebugScenariosWithRetry();
            SmokeTestLogger.info(
                "Start 'Attach to packager' dynamic config test: select and run 'Attach to packager' debug config",
            );
            await app.workbench.quickinput.selectQuickInputElement(1, false);
            const hostAddress = "127.0.0.1";
            SmokeTestLogger.info(
                `Start 'Attach to packager' dynamic config test: enter ${hostAddress} address`,
            );
            await app.workbench.quickinput.inputAndSelect(hostAddress);
            SmokeTestLogger.info(
                "Start 'Attach to packager' dynamic config test: skip port changing",
            );
            await app.workbench.quickinput.selectQuickInputElement(0);
            SmokeTestLogger.info(
                "Start 'Attach to packager' dynamic config test: waiting for packager started",
            );
            const packagerStarted = await findPackagerStartedStrInLogFile();
            if (!packagerStarted) {
                assert.fail("Packager started string is not found");
                return;
            }
            SmokeTestLogger.success(
                "Start 'Attach to packager' dynamic config test: Packager started string is found'",
            );
            await automationHelper.disconnectFromDebuggerWithRetry();
            SmokeTestLogger.info(
                "Start 'Attach to packager' dynamic config test: Debugging is stopped",
            );
        });
    });
}
