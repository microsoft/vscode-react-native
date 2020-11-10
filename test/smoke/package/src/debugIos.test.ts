// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { AppiumHelper, AppiumClient, Platform } from "./helpers/appiumHelper";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { RNworkspacePath, runVSCode, ExpoWorkspacePath, pureRNWorkspacePath } from "./main";
import { IosSimulatorHelper } from "./helpers/iosSimulatorHelper";
import { sleep, findFile, findExpoURLInLogFile, findExpoSuccessAndFailurePatterns, ExpoLaunch, getIOSBuildPath, waitUntilLaunchScenarioTargetUpdate } from "./helpers/utilities";
import { SetupEnvironmentHelper } from "./helpers/setupEnvironmentHelper";
import * as path from "path";
import { TestRunArguments } from "./helpers/configHelper";
import { Application } from "../../automation";
import { IiOSSimulator } from "./helpers/iosSimulatorHelper";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";

const RnAppBundleId = "org.reactjs.native.example.latestRNApp";
const RNDebugConfigName = "Debug iOS";
const ExpoDebugConfigName = "Debug in Exponent";
const ExpoLanDebugConfigName = "Debug in Exponent (LAN)";
const ExpoLocalDebugConfigName = "Debug in Exponent (Local)";

const RNSetBreakpointOnLine = 1;
const ExpoSetBreakpointOnLine = 1;
// Time for OS Debug Test before it reaches timeout
const debugIosTestTime = SmokeTestsConstants.iosAppBuildAndInstallTimeout + 100 * 1000;
// Time for iOS Expo Debug Test before it reaches timeout
const debugExpoTestTime = SmokeTestsConstants.expoAppBuildAndInstallTimeout + 400 * 1000;

let expoFirstLaunch = true;

export function setup(testParameters?: TestRunArguments): void {
    describe("Debugging iOS", () => {
        let app: Application;
        let client: AppiumClient | null;

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

        function compareSimulatorWithInputConfig(simulator: IiOSSimulator) {
            assert.strictEqual(simulator.system, AppiumHelper.getIosPlatformVersion(), `The simulator is booted with the wrong system: iOS-(${simulator.system})`);
            assert.strictEqual(simulator.id, IosSimulatorHelper.getDeviceUdid(), `The simulator is booted with the wrong udid: (${simulator.id})`);
            assert.strictEqual(simulator.name, IosSimulatorHelper.getDevice(), `The simulator is booted with the wrong name: (${simulator.name})`);
        }

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
            const device = <string>IosSimulatorHelper.getDevice();
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
            let appFile = findFile(SetupEnvironmentHelper.iOSExpoAppsCacheDir, /.*\.(app)/);
            if (!appFile) {
                throw new Error(`iOS Expo app is not found in ${SetupEnvironmentHelper.iOSExpoAppsCacheDir}`);
            }
            const appPath = path.join(SetupEnvironmentHelper.iOSExpoAppsCacheDir, appFile);
            const opts = AppiumHelper.prepareAttachOptsForIosApp(device, appPath);
            client = await AppiumHelper.webdriverAttach(opts);
            await AppiumHelper.openExpoApplication(Platform.iOS, client, expoURL, workspacePath, expoFirstLaunch);
            expoFirstLaunch = false;
            SmokeTestLogger.info(`${testName}: Waiting ${SmokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`);
            await sleep(SmokeTestsConstants.expoAppBuildAndInstallTimeout);

            await AppiumHelper.disableExpoErrorRedBox(client);
            await AppiumHelper.disableDevMenuInformationalMsg(client, Platform.iOSExpo);
            await AppiumHelper.enableRemoteDebugJS(client, Platform.iOSExpo);
            await sleep(5 * 1000);

            await app.workbench.debug.waitForDebuggingToStart();
            SmokeTestLogger.info(`${testName}: Debugging started`);
            await app.workbench.debug.waitForStackFrame(sf => sf.name === appFileName && sf.lineNumber === ExpoSetBreakpointOnLine, `looking for ${appFileName} and line ${ExpoSetBreakpointOnLine}`);
            SmokeTestLogger.info(`${testName}: Stack frame found`);
            await app.workbench.debug.stepOver();
            // Wait for our debug string to render in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            SmokeTestLogger.info(`${testName}: Searching for \"Test output from debuggee\" string in console`);
            let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            SmokeTestLogger.success(`${testName}: \"Test output from debuggee\" string is found`);
            await app.workbench.debug.disconnectFromDebugger();
            SmokeTestLogger.info(`${testName}: Debugging is stopped`);
        }

        it("RN app Debug test", async function () {
            this.timeout(debugIosTestTime);
            app = await runVSCode(RNworkspacePath);
            await app.workbench.quickaccess.openFile("App.js");
            await app.workbench.editors.scrollTop();
            SmokeTestLogger.info("iOS Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(RNSetBreakpointOnLine);
            SmokeTestLogger.info(`iOS Debug test: Breakpoint is set on line ${RNSetBreakpointOnLine}`);
            SmokeTestLogger.info(`iOS Debug test: Chosen debug configuration: ${RNDebugConfigName}`);
            // We need to implicitly add target to "Debug iOS" configuration to avoid running additional simulator
            SetupEnvironmentHelper.setIosTargetToLaunchJson(RNworkspacePath, RNDebugConfigName, IosSimulatorHelper.getDevice());
            SmokeTestLogger.info("iOS Debug test: Starting debugging");
            await app.workbench.quickaccess.runDebugScenario(RNDebugConfigName);

            await IosSimulatorHelper.waitUntilIosAppIsInstalled(RnAppBundleId, SmokeTestsConstants.iosAppBuildAndInstallTimeout, 40 * 1000);
            const device = <string>IosSimulatorHelper.getDevice();
            const buildPath = getIOSBuildPath(
                `${RNworkspacePath}/ios`,
                `${SmokeTestsConstants.RNAppName}.xcworkspace`,
                "Debug",
                SmokeTestsConstants.RNAppName,
                "iphonesimulator"
            );
            const appPath = `${buildPath}/${SmokeTestsConstants.RNAppName}.app`;
            const opts = AppiumHelper.prepareAttachOptsForIosApp(device, appPath);
            client = await AppiumHelper.webdriverAttach(opts);
            await AppiumHelper.enableRemoteDebugJS(client, Platform.iOS);
            await sleep(5 * 1000);

            await app.workbench.debug.waitForDebuggingToStart();
            SmokeTestLogger.info("iOS Debug test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === RNSetBreakpointOnLine, `looking for App.js and line ${RNSetBreakpointOnLine}`);
            SmokeTestLogger.info("iOS Debug test: Stack frame found");
            await app.workbench.debug.stepOver();
            // Wait for our debug string to render in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            SmokeTestLogger.info("iOS Debug test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            SmokeTestLogger.success("iOS Debug test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.disconnectFromDebugger();
            SmokeTestLogger.info("iOS Debug test: Debugging is stopped");
        });

        it("Expo app Debug test(Tunnel)", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            await expoTest("App.tsx", "iOS Expo Debug test(Tunnel)", ExpoWorkspacePath, ExpoDebugConfigName, 5);
        });

        it("Pure RN app Expo test(LAN)", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            await expoTest("App.js", "iOS pure RN Expo test(LAN)", pureRNWorkspacePath, ExpoLanDebugConfigName, 1);
        });

        it("Expo app Debug test(LAN)", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            await expoTest("App.tsx", "iOS Expo Debug test(LAN)", ExpoWorkspacePath, ExpoLanDebugConfigName, 1);
        });

        it("Expo app Debug test(localhost)", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            await expoTest("App.tsx", "iOS Expo Debug test(localhost)", ExpoWorkspacePath, ExpoLocalDebugConfigName, 1);
        });

        it("Save iOS simulator test", async function () {
            let deviceName = IosSimulatorHelper.getDevice();
            if (!deviceName) {
                deviceName = "";
            }
            this.timeout(debugIosTestTime);
            await SetupEnvironmentHelper.terminateIosSimulator();
            app = await runVSCode(RNworkspacePath);
            SetupEnvironmentHelper.setIosTargetToLaunchJson(RNworkspacePath, RNDebugConfigName, SmokeTestsConstants.SimulatorString);
            SmokeTestLogger.info("iOS simulator save test: Starting debugging at the first time");
            await app.workbench.quickaccess.runDebugScenario(RNDebugConfigName);
            SmokeTestLogger.info("iOS simulator save test: Debugging started at the first time");
            await app.workbench.quickinput.waitForQuickInputOpened();
            await app.workbench.quickinput.inputAndSelect(IosSimulatorHelper.getFormattedIOSVersion());
            await app.workbench.quickinput.submit(deviceName);
            let simulator = await IosSimulatorHelper.waitUntilIosSimulatorStarting(deviceName);
            compareSimulatorWithInputConfig(simulator);
            const isScenarioUpdated = await waitUntilLaunchScenarioTargetUpdate(RNworkspacePath, Platform.iOS);
            SmokeTestLogger.info(`iOS simulator save test: there is ${isScenarioUpdated ? "" : "no"} '"target": "${IosSimulatorHelper.getDeviceUdid()}"' in launch.json`);
            assert.notStrictEqual(isScenarioUpdated, false, "The launch.json has not been updated");
            await disposeAll();
            await SetupEnvironmentHelper.terminateIosSimulator();
            app = await runVSCode(RNworkspacePath);
            SmokeTestLogger.info("iOS simulator save test: Starting debugging at the second time");
            await app.workbench.quickaccess.runDebugScenario(RNDebugConfigName);
            SmokeTestLogger.info("iOS simulator save test: Debugging started at the second time");
            simulator = await IosSimulatorHelper.waitUntilIosSimulatorStarting(deviceName);
            compareSimulatorWithInputConfig(simulator);
        });
    });
}
