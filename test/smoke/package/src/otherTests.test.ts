// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { Application } from "../../automation";
import AndroidEmulatorManager from "./helpers/androidEmulatorManager";
import IosSimulatorManager from "./helpers/iosSimulatorManager";
import { LaunchConfigurationManager } from "./helpers/launchConfigurationManager";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import { sleep } from "./helpers/utilities";
import { androidEmulatorManager, iosSimulatorManager, vscodeManager } from "./main";

const AndroidRNDebugConfigName = "Debug Android";

const IosRNDebugConfigName = "Debug iOS";

// Time for Android Debug Test before it reaches timeout
const debugAndroidTestTime = SmokeTestsConstants.androidTestTimeout;
// Time for iOS Debug Test before it reaches timeout
const debugIosTestTime = SmokeTestsConstants.iosTestTimeout;


export function startOtherTests(workspace: string, testParameters?: TestRunArguments): void {

    describe("React Native", () => {
        let app: Application;

        async function disposeAll() {
            SmokeTestLogger.info("Dispose all ...");
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await app.workbench.quickaccess.runCommand(SmokeTestsConstants.stopPackagerCommand);
                await sleep(3000);
                await app.stop();
            }
        }

        afterEach(disposeAll);

        // Android tests
        if (!testParameters || testParameters.RunAndroidTests) {
            it("Save Android emulator test", async function () {
                this.timeout(debugAndroidTestTime);
                const launchConfigurationManager = new LaunchConfigurationManager(workspace);
                app = await vscodeManager.runVSCode(workspace, `Save Android emulator test (first launch)`);
                SmokeTestLogger.info("Android emulator save test: Terminating all Android emulators");
                await AndroidEmulatorManager.terminateAllAndroidEmulators();
                SmokeTestLogger.info("Android emulator save test: Starting debugging in first time");
                await app.workbench.quickaccess.runDebugScenario(AndroidRNDebugConfigName);
                SmokeTestLogger.info("Android emulator save test: Debugging started in first time");
                SmokeTestLogger.info("Android emulator save test: Wait until emulator starting");
                await androidEmulatorManager.waitUntilEmulatorStarting();
                const isScenarioUpdated = await launchConfigurationManager.waitUntilLaunchScenarioUpdate({ target: androidEmulatorManager.getEmulatorName() }, AndroidRNDebugConfigName);
                SmokeTestLogger.info(`Android emulator save test: launch.json is ${isScenarioUpdated ? "" : "not "}contains '"target": "${androidEmulatorManager.getEmulatorName()}"'`);
                assert.notStrictEqual(isScenarioUpdated, false, "The launch.json has not been updated");
                SmokeTestLogger.info("Android emulator save test: Dispose all");
                await disposeAll();
                app = await vscodeManager.runVSCode(workspace, `Save Android emulator test (second launch)`);
                SmokeTestLogger.info("Android emulator save test: Terminating all Android emulators");
                await AndroidEmulatorManager.terminateAllAndroidEmulators();
                SmokeTestLogger.info("Android emulator save test: Starting debugging in second time");
                await app.workbench.quickaccess.runDebugScenario(AndroidRNDebugConfigName);
                SmokeTestLogger.info("Android emulator save test: Debugging started in second time");
                const emulatorIsStarted = await androidEmulatorManager.waitUntilEmulatorStarting();
                assert.strictEqual(emulatorIsStarted, true, "The emulator has not been started after update launch.json");
            });
        }

        // iOS tests
        if (process.platform === "darwin" && (!testParameters || testParameters.RunIosTests)) {
            it("Save iOS simulator test", async function () {
                let simulator = iosSimulatorManager.getSimulator();
                this.timeout(debugIosTestTime);
                const launchConfigurationManager = new LaunchConfigurationManager(workspace);
                await IosSimulatorManager.shutdownAllSimulators();
                app = await vscodeManager.runVSCode(workspace, `Save iOS simulator test (first launch)`);
                launchConfigurationManager.updateLaunchScenario(IosRNDebugConfigName, { target: "simulator" });
                SmokeTestLogger.info("iOS simulator save test: Starting debugging at the first time");
                await app.workbench.quickaccess.runDebugScenario(IosRNDebugConfigName);
                SmokeTestLogger.info("iOS simulator save test: Debugging started at the first time");
                await app.workbench.quickinput.waitForQuickInputOpened();
                await app.workbench.quickinput.inputAndSelect(simulator.system);
                await app.workbench.quickinput.submit(simulator.name);
                let isStarted = await iosSimulatorManager.waitUntilIosSimulatorStarting();
                assert.strictEqual(isStarted, true, `Could not boot iOS simulator ${simulator.name} in first time`);
                const isScenarioUpdated = launchConfigurationManager.waitUntilLaunchScenarioUpdate({ target: simulator.id }, IosRNDebugConfigName);
                SmokeTestLogger.info(`iOS simulator save test: there is ${isScenarioUpdated ? "" : "no"} '"target": "${simulator.id}"' in launch.json`);
                assert.notStrictEqual(isScenarioUpdated, false, "The launch.json has not been updated");
                await disposeAll();
                await IosSimulatorManager.shutdownAllSimulators();
                app = await vscodeManager.runVSCode(workspace, `Save iOS simulator test (second launch)`);
                SmokeTestLogger.info("iOS simulator save test: Starting debugging at the second time");
                await app.workbench.quickaccess.runDebugScenario(IosRNDebugConfigName);
                SmokeTestLogger.info("iOS simulator save test: Debugging started at the second time");
                isStarted = await iosSimulatorManager.waitUntilIosSimulatorStarting();
                assert.strictEqual(isStarted, true, `Could not boot iOS simulator ${simulator.name} in first time`);
            });
        }
    });
}
