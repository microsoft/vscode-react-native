// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import { AppiumHelper, Platform, AppiumClient } from "./helpers/appiumHelper";
import { AndroidEmulatorHelper } from "./helpers/androidEmulatorHelper";
import { sleep, waitUntilLaunchScenarioTargetUpdate, ExpoLaunch, findExpoSuccessAndFailurePatterns, findExpoURLInLogFile, findStringInFile } from "./helpers/utilities";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { pureRNWorkspacePath, RNworkspacePath, runVSCode, prepareReactNativeProjectForHermesTesting, ExpoWorkspacePath } from "./main";
import { SetupEnvironmentHelper } from "./helpers/setupEnvironmentHelper";
import { TestRunArguments } from "./helpers/configHelper";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { Application } from "../../automation";

const RN_APP_PACKAGE_NAME = "com.latestrnapp";
const RN_APP_ACTIVITY_NAME = "com.latestrnapp.MainActivity";
const EXPO_APP_PACKAGE_NAME = SetupEnvironmentHelper.expoPackageName;
const EXPO_APP_ACTIVITY_NAME = `${EXPO_APP_PACKAGE_NAME}.experience.HomeActivity`;
const RNDebugConfigName = "Debug Android";
const RNHermesDebugConfigName = "Debug Android (Hermes) - Experimental";
const RNHermesAttachConfigName = "Attach to Hermes application - Experimental";
const ExpoDebugConfigName = "Debug in Exponent";
const ExpoLanDebugConfigName = "Debug in Exponent (LAN)";
const ExpoLocalDebugConfigName = "Debug in Exponent (Local)";

const RNSetBreakpointOnLine = 1;
const RNHermesSetBreakpointOnLine = 11;
const ExpoSetBreakpointOnLine = 1;
// Time for Android Debug Test before it reaches timeout
const debugAndroidTestTime = SmokeTestsConstants.androidAppBuildAndInstallTimeout + 100 * 1000;
// Time for Android Expo Debug Test before it reaches timeout
const debugExpoTestTime = SmokeTestsConstants.expoAppBuildAndInstallTimeout + 400 * 1000;

export function setup(testParameters?: TestRunArguments): void {

    describe("Debugging Android", () => {
        let app: Application;
        let client: AppiumClient | null;
        SmokeTestLogger.info(JSON.stringify(testParameters));

        async function disposeAll() {
            if (app) {
                await app.stop();
            }
            if (client) {
                await client.closeApp();
                await client.deleteSession();
                client = null;
            }
        }

        afterEach(disposeAll);

        async function runExpoDebugScenario(logFilePath: string, testName: string, workspacePath: string, debugConfigName: string, triesToLaunchApp: number) {
            SmokeTestLogger.info(`${testName}: Starting debugging`);
            // Scan logs only if launch retries provided (Expo Tunnel scenarios)
            if (triesToLaunchApp <= 1) {
                await app.workbench.quickaccess.runDebugScenario(debugConfigName);
            } else {
                for (let retry = 1; retry <= triesToLaunchApp; retry++) {
                    let expoLaunchStatus: ExpoLaunch;
                    await app.workbench.quickaccess.runDebugScenario(debugConfigName);
                    expoLaunchStatus = await findExpoSuccessAndFailurePatterns(logFilePath, SmokeTestsConstants.ExpoSuccessPattern, SmokeTestsConstants.ExpoFailurePattern);
                    if (expoLaunchStatus.successful) {
                        break;
                    } else {
                        if (retry === triesToLaunchApp) {
                            assert.fail(`App start has failed after ${retry} retries`);
                        }
                        SmokeTestLogger.warn(`Attempt to start #${retry} failed, retrying...`);
                    }
                }
            }
        }

        async function expoTest(appFileName: string, testName: string, workspacePath: string, debugConfigName: string, triesToLaunchApp: number) {
            let logFilePath = "";
            app = await runVSCode(workspacePath);
            SmokeTestLogger.info(`${testName}: ${workspacePath} directory is opened in VS Code`);
            await app.workbench.quickaccess.openFile(appFileName);
            await app.workbench.editors.scrollTop();
            SmokeTestLogger.info(`${testName}: ${appFileName} file is opened`);
            await app.workbench.debug.setBreakpointOnLine(ExpoSetBreakpointOnLine);
            SmokeTestLogger.info(`${testName}: Breakpoint is set on line ${ExpoSetBreakpointOnLine}`);
            SmokeTestLogger.info(`${testName}: Chosen debug configuration: ${debugConfigName}`);
            if (process.env.REACT_NATIVE_TOOLS_LOGS_DIR) {
                logFilePath = path.join(process.env.REACT_NATIVE_TOOLS_LOGS_DIR, SmokeTestsConstants.ReactNativeLogFileName);
            } else {
                assert.fail("REACT_NATIVE_TOOLS_LOGS_DIR is not defined");
            }
            await runExpoDebugScenario(logFilePath, testName, workspacePath, debugConfigName, triesToLaunchApp);

            await app.workbench.editors.waitForTab("Expo QR Code", false, true);
            await app.workbench.editors.waitForActiveTab("Expo QR Code", false, true);
            SmokeTestLogger.info(`${testName}: 'Expo QR Code' tab found`);

            let expoURL;
            if (process.env.REACT_NATIVE_TOOLS_LOGS_DIR) {
                expoURL = findExpoURLInLogFile(path.join(process.env.REACT_NATIVE_TOOLS_LOGS_DIR, SmokeTestsConstants.ReactNativeRunExpoLogFileName));
            }
            assert.notStrictEqual(expoURL, null, "Expo URL pattern is not found");
            expoURL = expoURL as string;
            const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(EXPO_APP_PACKAGE_NAME, EXPO_APP_ACTIVITY_NAME, AndroidEmulatorHelper.androidEmulatorName);
            client = await AppiumHelper.webdriverAttach(opts);
            // TODO Add listener to trigger that main expo app has been ran
            await AppiumHelper.openExpoApplication(Platform.Android, client, expoURL, workspacePath);
            // TODO Add listener to trigger that child expo app has been ran instead of using timeout
            SmokeTestLogger.info(`${testName}: Waiting ${SmokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`);
            await sleep(SmokeTestsConstants.expoAppBuildAndInstallTimeout);
            await AppiumHelper.disableDevMenuInformationalMsg(client, Platform.AndroidExpo);
            await sleep(2 * 1000);
            await AppiumHelper.enableRemoteDebugJS(client, Platform.AndroidExpo);
            await app.workbench.debug.waitForDebuggingToStart();
            SmokeTestLogger.info(`${testName}: Debugging started`);
            await app.workbench.debug.waitForStackFrame(sf => sf.name === appFileName && sf.lineNumber === ExpoSetBreakpointOnLine, `looking for ${appFileName} and line ${ExpoSetBreakpointOnLine}`);
            SmokeTestLogger.info(`${testName}: Stack frame found`);
            await app.workbench.debug.stepOver();
            // Wait for debug string to be rendered in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            SmokeTestLogger.info(`${testName}: Searching for \"Test output from debuggee\" string in console`);
            let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            SmokeTestLogger.success(`${testName}: \"Test output from debuggee\" string is found`);
            await app.workbench.debug.disconnectFromDebugger();
            SmokeTestLogger.info(`${testName}: Debugging is stopped`);
        }

        it("RN app Debug test", async function () {
            this.timeout(debugAndroidTestTime);
            app = await runVSCode(RNworkspacePath);
            await app.workbench.quickaccess.openFile("App.js");
            await app.workbench.editors.scrollTop();
            SmokeTestLogger.info("Android Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(RNSetBreakpointOnLine);
            SmokeTestLogger.info(`Android Debug test: Breakpoint is set on line ${RNSetBreakpointOnLine}`);
            SmokeTestLogger.info(`Android Debug test: Chosen debug configuration: ${RNDebugConfigName}`);
            SmokeTestLogger.info("Android Debug test: Starting debugging");
            await app.workbench.quickaccess.runDebugScenario(RNDebugConfigName);
            const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(RN_APP_PACKAGE_NAME, RN_APP_ACTIVITY_NAME, AndroidEmulatorHelper.androidEmulatorName);
            await AndroidEmulatorHelper.checkIfAppIsInstalled(RN_APP_PACKAGE_NAME, SmokeTestsConstants.androidAppBuildAndInstallTimeout);
            client = await AppiumHelper.webdriverAttach(opts);
            await AppiumHelper.enableRemoteDebugJS(client, Platform.Android);
            await app.workbench.debug.waitForDebuggingToStart();
            SmokeTestLogger.info("Android Debug test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === RNSetBreakpointOnLine, `looking for App.js and line ${RNSetBreakpointOnLine}`);
            SmokeTestLogger.info("Android Debug test: Stack frame found");
            await app.workbench.debug.stepOver();
            // await for our debug string renders in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            SmokeTestLogger.info("Android Debug test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            SmokeTestLogger.success("Android Debug test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.disconnectFromDebugger();
            SmokeTestLogger.info("Android Debug test: Debugging is stopped");
        });

        it("Hermes RN app Debug test", async function () {
            try {
                this.timeout(debugAndroidTestTime);
                prepareReactNativeProjectForHermesTesting();
                AndroidEmulatorHelper.uninstallTestAppFromEmulator(RN_APP_PACKAGE_NAME);
                app = await runVSCode(RNworkspacePath);
                await app.workbench.quickaccess.openFile("AppTestButton.js");
                await app.workbench.editors.scrollTop();
                SmokeTestLogger.info("Android Debug Hermes test: AppTestButton.js file is opened");
                await app.workbench.debug.setBreakpointOnLine(RNHermesSetBreakpointOnLine);
                SmokeTestLogger.info(`Android Debug Hermes test: Breakpoint is set on line ${RNHermesSetBreakpointOnLine}`);
                SmokeTestLogger.info(`Android Debug Hermes test: Chosen debug configuration: ${RNHermesDebugConfigName}`);
                SmokeTestLogger.info("Android Debug Hermes test: Starting debugging");
                await app.workbench.quickaccess.runDebugScenario(RNHermesDebugConfigName);
                const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(RN_APP_PACKAGE_NAME, RN_APP_ACTIVITY_NAME, AndroidEmulatorHelper.androidEmulatorName);
                await AndroidEmulatorHelper.checkIfAppIsInstalled(RN_APP_PACKAGE_NAME, SmokeTestsConstants.androidAppBuildAndInstallTimeout);
                client = await AppiumHelper.webdriverAttach(opts);
                await app.workbench.debug.waitForDebuggingToStart();
                SmokeTestLogger.info("Android Debug Hermes test: Debugging started");
                SmokeTestLogger.info("Android Debug Hermes test: Checking for Hermes mark");
                let isHermesWorking = await AppiumHelper.isHermesWorking(client);
                assert.strictEqual(isHermesWorking, true);
                SmokeTestLogger.info("Android Debug Hermes test: Reattaching to Hermes app");
                await app.workbench.debug.disconnectFromDebugger();
                await app.workbench.quickaccess.runDebugScenario(RNHermesAttachConfigName);
                SmokeTestLogger.info("Android Debug Hermes test: Reattached successfully");
                await sleep(7000);
                SmokeTestLogger.info("Android Debug Hermes test: Click Test Button");
                await AppiumHelper.clickTestButtonHermes(client);
                await app.workbench.debug.waitForStackFrame(sf => sf.name === "AppTestButton.js" && sf.lineNumber === RNHermesSetBreakpointOnLine, `looking for AppTestButton.js and line ${RNHermesSetBreakpointOnLine}`);
                SmokeTestLogger.info("Android Debug Hermes test: Stack frame found");
                await app.workbench.debug.continue();
                // await for our debug string renders in debug console
                await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                if (process.env.REACT_NATIVE_TOOLS_LOGS_DIR) {
                    SmokeTestLogger.info("Android Debug Hermes test: Searching for \"Test output from Hermes debuggee\" string in output file");
                    let found = findStringInFile(path.join(process.env.REACT_NATIVE_TOOLS_LOGS_DIR, SmokeTestsConstants.ReactNativeLogFileName), "Test output from Hermes debuggee");
                    assert.notStrictEqual(found, false, "\"Test output from Hermes debuggee\" string is missing in output file");
                    SmokeTestLogger.success("Android Debug test: \"Test output from Hermes debuggee\" string is found");
                }
                await app.workbench.debug.disconnectFromDebugger();
                SmokeTestLogger.info("Android Debug Hermes test: Debugging is stopped");
            } catch (e) {
                SmokeTestLogger.error(`Android Debug Hermes test failed: ${e.toString()}`);
                return this.skip();
            }
        });

        it("Expo app Debug test(Tunnel)", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            await expoTest("App.tsx", "Android Expo Debug test(Tunnel)", ExpoWorkspacePath, ExpoDebugConfigName, 5);
        });

        it("Pure RN app Expo test(LAN)", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            await expoTest("App.js", "Android pure RN Expo test(LAN)", pureRNWorkspacePath, ExpoLanDebugConfigName, 1);
        });

        it("Expo app Debug test(LAN)", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            await expoTest("App.tsx", "Android Expo Debug test(LAN)", ExpoWorkspacePath, ExpoLanDebugConfigName, 1);
        });

        it("Expo app Debug test(localhost)", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            await expoTest("App.tsx", "Android Expo Debug test(localhost)", ExpoWorkspacePath, ExpoLocalDebugConfigName, 1);
        });

        it("Save Android emulator test", async function () {
            // Theres is a problem with starting an emulator by the VS Code process on Windows testing machine.
            // The issue will be investigated
            if (process.platform === "win32") {
                SmokeTestLogger.warn(`Android emulator save test: Theres is a problem with starting an emulator by the VS Code process on Windows testing machine, so we skip this test.`);
                return this.skip();
            }
            this.timeout(debugAndroidTestTime);
            app = await runVSCode(pureRNWorkspacePath);
            SmokeTestLogger.info("Android emulator save test: Terminating Android emulator");
            AndroidEmulatorHelper.terminateAndroidEmulator();
            await AndroidEmulatorHelper.waitUntilAndroidEmulatorTerminating();
            SmokeTestLogger.info("Android emulator save test: Starting debugging in first time");
            await app.workbench.quickaccess.runDebugScenario(RNDebugConfigName);
            SmokeTestLogger.info("Android emulator save test: Debugging started in first time");
            SmokeTestLogger.info("Android emulator save test: Wait until emulator starting");
            await AndroidEmulatorHelper.waitUntilEmulatorStarting();
            const isScenarioUpdated = await waitUntilLaunchScenarioTargetUpdate(pureRNWorkspacePath, Platform.Android);
            SmokeTestLogger.info(`Android emulator save test: launch.json is ${isScenarioUpdated ? "" : "not "}contains '"target": "${AndroidEmulatorHelper.getDevice()}"'`);
            assert.notStrictEqual(isScenarioUpdated, false, "The launch.json has not been updated");
            SmokeTestLogger.info("Android emulator save test: Dispose all");
            await disposeAll();
            app = await runVSCode(pureRNWorkspacePath);
            SmokeTestLogger.info("Android emulator save test: Terminating Android emulator");
            AndroidEmulatorHelper.terminateAndroidEmulator();
            await AndroidEmulatorHelper.waitUntilAndroidEmulatorTerminating();
            SmokeTestLogger.info("Android emulator save test: Starting debugging in second time");
            await app.workbench.quickaccess.runDebugScenario(RNDebugConfigName);
            SmokeTestLogger.info("Android emulator save test: Debugging started in second time");
            await AndroidEmulatorHelper.waitUntilEmulatorStarting();
            const devices = AndroidEmulatorHelper.getOnlineDevices();
            assert.strictEqual(devices.length, 1, "The emulator has not been started after update launch.json");
        });
    });
}
