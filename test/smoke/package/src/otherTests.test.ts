// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { Application } from "../../automation";
import AndroidEmulatorManager from "./helpers/androidEmulatorManager";
import AutomationHelper from "./helpers/AutomationHelper";
import IosSimulatorManager from "./helpers/iosSimulatorManager";
import { LaunchConfigurationManager } from "./helpers/launchConfigurationManager";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import TestProject from "./helpers/testProject";
import { sleep } from "./helpers/utilities";
import { androidEmulatorManager, iosSimulatorManager, vscodeManager } from "./main";

const RN_APP_PACKAGE_NAME = "com.latestrnapp";
const AndroidRNDebugConfigName = "Debug Android";

const IosRNDebugConfigName = "Debug classic iOS";

// Time for Android Debug Test before it reaches timeout
const debugAndroidTestTime = SmokeTestsConstants.androidTestTimeout;
// Time for iOS Debug Test before it reaches timeout
const debugIosTestTime = SmokeTestsConstants.iosTestTimeout;

export function startOtherTests(project: TestProject, testParameters?: TestRunArguments): void {
    describe("React Native", () => {
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
                SmokeTestLogger.info("Clearing android application ...");
                AndroidEmulatorManager.closeApp(RN_APP_PACKAGE_NAME);
            } catch (error) {
                SmokeTestLogger.error("Error while disposeAll:");
                SmokeTestLogger.error(error);
                // throw error;
            }
        }

        afterEach(disposeAll);

        // Android tests
        if (!testParameters || testParameters.RunAndroidTests) {
            it("Save Android emulator test", async function () {
                this.timeout(debugAndroidTestTime);
                const launchConfigurationManager = new LaunchConfigurationManager(
                    project.workspaceDirectory,
                );
                app = await initApp(
                    project.workspaceDirectory,
                    `Save Android emulator test (first launch)`,
                );
                SmokeTestLogger.info(
                    "Android emulator save test: Terminating all Android emulators",
                );
                await AndroidEmulatorManager.terminateAllAndroidEmulators();
                SmokeTestLogger.info(
                    "Android emulator save test: Starting debugging in first time",
                );
                await automationHelper.runDebugScenarioWithRetry(AndroidRNDebugConfigName);
                SmokeTestLogger.info("Android emulator save test: Debugging started in first time");
                SmokeTestLogger.info("Android emulator save test: Wait until emulator starting");
                await androidEmulatorManager.waitUntilEmulatorStarting();
                const isScenarioUpdated = await launchConfigurationManager.waitUntilLaunchScenarioUpdate(
                    { target: androidEmulatorManager.getEmulatorName() },
                    AndroidRNDebugConfigName,
                );
                SmokeTestLogger.info(
                    `Android emulator save test: launch.json is ${
                        isScenarioUpdated ? "" : "not "
                    }contains '"target": "${androidEmulatorManager.getEmulatorName()}"'`,
                );
                assert.notStrictEqual(
                    isScenarioUpdated,
                    false,
                    "The launch.json has not been updated",
                );
                SmokeTestLogger.info("Android emulator save test: Dispose all");
                await disposeAll();
                app = await initApp(
                    project.workspaceDirectory,
                    `Save Android emulator test (second launch)`,
                );
                SmokeTestLogger.info(
                    "Android emulator save test: Terminating all Android emulators",
                );
                await AndroidEmulatorManager.terminateAllAndroidEmulators();
                SmokeTestLogger.info(
                    "Android emulator save test: Starting debugging in second time",
                );
                await automationHelper.runDebugScenarioWithRetry(AndroidRNDebugConfigName);
                SmokeTestLogger.info(
                    "Android emulator save test: Debugging started in second time",
                );
                const emulatorIsStarted = await androidEmulatorManager.waitUntilEmulatorStarting();
                assert.strictEqual(
                    emulatorIsStarted,
                    true,
                    "The emulator has not been started after update launch.json",
                );
            });
        }

        // iOS tests
        if (process.platform === "darwin" && (!testParameters || testParameters.RunIosTests)) {
            it("Save iOS simulator test", async function () {
                let simulator = iosSimulatorManager.getSimulator();
                this.timeout(debugIosTestTime);
                const launchConfigurationManager = new LaunchConfigurationManager(
                    project.workspaceDirectory,
                );
                await IosSimulatorManager.shutdownAllSimulators();
                app = await initApp(
                    project.workspaceDirectory,
                    `Save iOS simulator test (first launch)`,
                );
                launchConfigurationManager.updateLaunchScenario(IosRNDebugConfigName, {
                    target: "simulator",
                });
                await sleep(10000);
                await IosSimulatorManager.shutdownAllSimulators();
                SmokeTestLogger.info(
                    "iOS simulator save test: Starting debugging at the first time",
                );
                await automationHelper.runDebugScenarioWithRetry(IosRNDebugConfigName);
                SmokeTestLogger.info(
                    "iOS simulator save test: Debugging started at the first time",
                );
                await app.workbench.quickinput.waitForQuickInputOpened();
                await app.workbench.quickinput.inputAndSelect(simulator.system);
                await app.workbench.quickinput.submit(simulator.name);
                let isStarted = await iosSimulatorManager.waitUntilIosSimulatorStarting();
                assert.strictEqual(
                    isStarted,
                    true,
                    `Could not boot iOS simulator ${simulator.name} in first time`,
                );
                const isScenarioUpdated = launchConfigurationManager.waitUntilLaunchScenarioUpdate(
                    { target: simulator.id },
                    IosRNDebugConfigName,
                );
                SmokeTestLogger.info(
                    `iOS simulator save test: there is ${
                        isScenarioUpdated ? "" : "no"
                    } '"target": "${simulator.id}"' in launch.json`,
                );
                assert.notStrictEqual(
                    isScenarioUpdated,
                    false,
                    "The launch.json has not been updated",
                );
                await disposeAll();
                await IosSimulatorManager.shutdownAllSimulators();
                app = await initApp(
                    project.workspaceDirectory,
                    `Save iOS simulator test (second launch)`,
                );
                SmokeTestLogger.info(
                    "iOS simulator save test: Starting debugging at the second time",
                );
                await automationHelper.runDebugScenarioWithRetry(IosRNDebugConfigName);
                SmokeTestLogger.info(
                    "iOS simulator save test: Debugging started at the second time",
                );
                isStarted = await iosSimulatorManager.waitUntilIosSimulatorStarting();
                assert.strictEqual(
                    isStarted,
                    true,
                    `Could not boot iOS simulator ${simulator.name} in first time`,
                );
            });
        }
    });
}
