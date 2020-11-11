// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { Application } from "../../automation";
import AndroidEmulatorManager from "./helpers/AndroidEmulatorManager";
import { AppiumClient, AppiumHelper, Platform } from "./helpers/appiumHelper";
import IosSimulatorManager from "./helpers/IosSimulatorManager";
import { LaunchConfigurationManager } from "./helpers/LaunchConfigurationManager";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/TestConfigProcessor";
import { sleep } from "./helpers/utilities";
import { androidEmulatorManager, iosSimulatorManager, vscodeManager } from "./main";

const RN_APP_PACKAGE_NAME = "com.latestrnapp";
const RN_APP_ACTIVITY_NAME = "com.latestrnapp.MainActivity";
const AndroidRNDebugConfigName = "Debug Android";

const RnAppBundleId = "org.reactjs.native.example.latestRNApp";
const IosRNDebugConfigName = "Debug iOS";

const RNSetBreakpointOnLine = 1;
// Time for Android Debug Test before it reaches timeout
const debugAndroidTestTime = SmokeTestsConstants.androidTestTimeout;
// Time for OS Debug Test before it reaches timeout
const debugIosTestTime = SmokeTestsConstants.iosTestTimeout;

export function startReactNativeTests(workspace: string, testParameters?: TestRunArguments): void {

    describe("React Native", () => {
        let app: Application;
        let client: AppiumClient;
        const launchConfigurationManager = new LaunchConfigurationManager(workspace);

        async function disposeAll() {
            if (app) {
                await app.stop();
            }
            if (client) {
                await client.closeApp();
                await client.deleteSession();
            }
        }

        afterEach(disposeAll);

        if (!testParameters || testParameters.RunAndroidTests) {
            it("Android RN app Debug test", async function () {
                this.timeout(debugAndroidTestTime);
                app = await vscodeManager.runVSCode(workspace, this.currentTest?.title);
                await app.workbench.quickaccess.openFile("App.js");
                await app.workbench.editors.scrollTop();
                console.log("Android Debug test: App.js file is opened");
                await app.workbench.debug.setBreakpointOnLine(RNSetBreakpointOnLine);
                console.log(`Android Debug test: Breakpoint is set on line ${RNSetBreakpointOnLine}`);
                console.log(`Android Debug test: Chosen debug configuration: ${AndroidRNDebugConfigName}`);
                console.log("Android Debug test: Starting debugging");
                await app.workbench.quickaccess.runDebugScenario(AndroidRNDebugConfigName);
                const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(RN_APP_PACKAGE_NAME, RN_APP_ACTIVITY_NAME, androidEmulatorManager.getEmulatorName());
                await androidEmulatorManager.waitUntilAppIsInstalled(RN_APP_PACKAGE_NAME);
                let client = await AppiumHelper.webdriverAttach(opts);
                await AppiumHelper.enableRemoteDebugJS(client, Platform.Android);
                await app.workbench.debug.waitForDebuggingToStart();
                console.log("Android Debug test: Debugging started");
                await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === RNSetBreakpointOnLine, `looking for App.js and line ${RNSetBreakpointOnLine}`);
                console.log("Android Debug test: Stack frame found");
                await app.workbench.debug.stepOver();
                // await for our debug string renders in debug console
                await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                console.log("Android Debug test: Searching for \"Test output from debuggee\" string in console");
                let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
                console.log(found);
                assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
                console.log("Android Debug test: \"Test output from debuggee\" string is found");
                await app.workbench.debug.disconnectFromDebugger();
                console.log("Android Debug test: Debugging is stopped");
            });

            it("Save Android emulator test", async function () {
                // Theres is a problem with starting an emulator by the VS Code process on Windows testing machine.
                // The issue will be investigated
                if (process.platform === "win32") {
                    console.log(`Android emulator save test: Theres is a problem with starting an emulator by the VS Code process on Windows testing machine, so we skip this test.`);
                    return this.skip();
                }
                this.timeout(debugAndroidTestTime);
                app = await vscodeManager.runVSCode(workspace);
                console.log("Android emulator save test: Terminating all Android emulators");
                await AndroidEmulatorManager.terminateAllAndroidEmulators();
                console.log("Android emulator save test: Starting debugging in first time");
                await app.workbench.quickaccess.runDebugScenario(AndroidRNDebugConfigName);
                console.log("Android emulator save test: Debugging started in first time");
                console.log("Android emulator save test: Wait until emulator starting");
                await androidEmulatorManager.waitUntilEmulatorStarting();
                const isScenarioUpdated = await launchConfigurationManager.waitUntilLaunchScenarioUpdate({ target: androidEmulatorManager.getEmulatorName() }, { name: AndroidRNDebugConfigName });
                console.log(`Android emulator save test: launch.json is ${isScenarioUpdated ? "" : "not "}contains '"target": "${androidEmulatorManager.getEmulatorName()}"'`);
                assert.notStrictEqual(isScenarioUpdated, false, "The launch.json has not been updated");
                console.log("Android emulator save test: Dispose all");
                await disposeAll();
                app = await vscodeManager.runVSCode(workspace);
                console.log("Android emulator save test: Terminating all Android emulators");
                await AndroidEmulatorManager.terminateAllAndroidEmulators();
                console.log("Android emulator save test: Starting debugging in second time");
                await app.workbench.quickaccess.runDebugScenario(AndroidRNDebugConfigName);
                console.log("Android emulator save test: Debugging started in second time");
                const emulatorIsStarted = await androidEmulatorManager.waitUntilEmulatorStarting();
                assert.strictEqual(emulatorIsStarted, true, "The emulator has not been started after update launch.json");
            });
        }

        if (process.platform === "darwin" && (!testParameters || testParameters.RunIosTests)) {
            it("iOS RN app Debug test", async function () {
                if (process.platform !== "darwin") {
                    console.log(`iOS RN app Debug test: skip test if running not on macOS`);
                    return this.skip();
                }
                this.timeout(debugIosTestTime);
                const deviceName = iosSimulatorManager.getSimulator().name;
                app = await vscodeManager.runVSCode(workspace, this.currentTest?.title);
                await app.workbench.quickaccess.openFile("App.js");
                await app.workbench.editors.scrollTop();
                console.log("iOS Debug test: App.js file is opened");
                await app.workbench.debug.setBreakpointOnLine(RNSetBreakpointOnLine);
                console.log(`iOS Debug test: Breakpoint is set on line ${RNSetBreakpointOnLine}`);
                console.log(`iOS Debug test: Chosen debug configuration: ${IosRNDebugConfigName}`);
                // We need to implicitly add target to "Debug iOS" configuration to avoid running additional simulator
                launchConfigurationManager.updateLaunchScenario({ name: IosRNDebugConfigName }, { target: deviceName });
                console.log("iOS Debug test: Starting debugging");
                await app.workbench.quickaccess.runDebugScenario(IosRNDebugConfigName);
                await iosSimulatorManager.waitUntilIosAppIsInstalled(RnAppBundleId);
                const buildPath = IosSimulatorManager.getIOSBuildPath(
                    `${workspace}/ios`,
                    `${SmokeTestsConstants.RNAppName}.xcworkspace`,
                    "Debug",
                    SmokeTestsConstants.RNAppName,
                    "iphonesimulator"
                );
                const appPath = `${buildPath}/${SmokeTestsConstants.RNAppName}.app`;
                const opts = AppiumHelper.prepareAttachOptsForIosApp(deviceName, appPath);
                let client = await AppiumHelper.webdriverAttach(opts);
                await AppiumHelper.enableRemoteDebugJS(client, Platform.iOS);
                await sleep(5 * 1000);

                await app.workbench.debug.waitForDebuggingToStart();
                console.log("iOS Debug test: Debugging started");
                await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === RNSetBreakpointOnLine, `looking for App.js and line ${RNSetBreakpointOnLine}`);
                console.log("iOS Debug test: Stack frame found");
                await app.workbench.debug.stepOver();
                // Wait for our debug string to render in debug console
                await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                console.log("iOS Debug test: Searching for \"Test output from debuggee\" string in console");
                let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
                assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
                console.log("iOS Debug test: \"Test output from debuggee\" string is found");
                await app.workbench.debug.disconnectFromDebugger();
                console.log("iOS Debug test: Debugging is stopped");
            });

            it("Save iOS simulator test", async function () {
                if (process.platform !== "darwin") {
                    console.log(`Save iOS simulator test: skip test if running not on macOS`);
                    return this.skip();
                }

                let simulator = iosSimulatorManager.getSimulator();
                this.timeout(debugIosTestTime);
                await IosSimulatorManager.shutdownAllSimulators();
                app = await vscodeManager.runVSCode(workspace);
                launchConfigurationManager.updateLaunchScenario({ name: IosRNDebugConfigName }, { target: "simulator" });
                console.log("iOS simulator save test: Starting debugging at the first time");
                await app.workbench.quickaccess.runDebugScenario(IosRNDebugConfigName);
                console.log("iOS simulator save test: Debugging started at the first time");
                await app.workbench.quickinput.waitForQuickInputOpened();
                await app.workbench.quickinput.inputAndSelect(iosSimulatorManager.getFormattedIOSVersion());
                await app.workbench.quickinput.submit(simulator.name);
                let isStarted = await iosSimulatorManager.waitUntilIosSimulatorStarting();
                assert.strictEqual(isStarted, true, `Could not boot iOS simulator ${this.simulator.name} in first time`);
                const isScenarioUpdated = launchConfigurationManager.waitUntilLaunchScenarioUpdate({ target: simulator.id }, { name: IosRNDebugConfigName });
                console.log(`iOS simulator save test: there is ${isScenarioUpdated ? "" : "no"} '"target": "${simulator.id}"' in launch.json`);
                assert.notStrictEqual(isScenarioUpdated, false, "The launch.json has not been updated");
                await disposeAll();
                await IosSimulatorManager.shutdownAllSimulators();
                app = await vscodeManager.runVSCode(workspace);
                console.log("iOS simulator save test: Starting debugging at the second time");
                await app.workbench.quickaccess.runDebugScenario(IosRNDebugConfigName);
                console.log("iOS simulator save test: Debugging started at the second time");
                isStarted = await iosSimulatorManager.waitUntilIosSimulatorStarting();
                assert.strictEqual(isStarted, true, `Could not boot iOS simulator ${this.simulator.name} in first time`);
            });
        }
    });
}
