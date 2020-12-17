// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import { Application } from "../../automation";
import { AppiumClient, AppiumHelper, Platform } from "./helpers/appiumHelper";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { findFile, findStringInFile, sleep, waitUntil } from "./helpers/utilities";
import { androidEmulatorManager, iosSimulatorManager, vscodeManager } from "./main";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";

const EXPO_APP_LAUNCH_TIMEOUT = 120_000;
const ExpoSuccessPattern = "Tunnel ready";
const ExpoFailurePattern = "XDLError";

const EXPO_APP_PACKAGE_NAME = SmokeTestsConstants.expoPackageName;
const EXPO_APP_ACTIVITY_NAME = `${SmokeTestsConstants.expoPackageName}.experience.HomeActivity`;
const ExpoDebugConfigName = "Debug in Exponent";
const ExpoLanDebugConfigName = "Debug in Exponent (LAN)";
const ExpoLocalDebugConfigName = "Debug in Exponent (Local)";

const ExpoSetBreakpointOnLine = 1;
// Time for Android Expo Debug Test before it reaches timeout
const debugExpoTestTime = SmokeTestsConstants.expoTestTimeout;

interface ExpoLaunch {
    successful: boolean;
    failed: boolean;
}

export function startExpoTests(
    expoWorkspace: string,
    pureWorkspace: string,
    testParameters: TestRunArguments,
): void {
    describe("Expo tests", () => {
        let app: Application;
        let expoFirstLaunch = true;
        let client: AppiumClient;

        async function disposeAll() {
            SmokeTestLogger.info("Dispose all ...");
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await app.workbench.quickaccess.runCommand(SmokeTestsConstants.stopPackagerCommand);
                await sleep(3000);
                await app.stop();
            }
            if (client) {
                await client.closeApp();
                await client.deleteSession();
            }
        }

        afterEach(disposeAll);

        async function findExpoSuccessAndFailurePatterns(
            filePath: string,
            successPattern: string,
            failurePattern: string,
        ): Promise<ExpoLaunch> {
            let result: ExpoLaunch | undefined = undefined;

            const condition = () => {
                let expoStarted = findStringInFile(filePath, successPattern);
                let expoFailed = findStringInFile(filePath, failurePattern);
                SmokeTestLogger.info(`Searching for Expo launch logging patterns ...`);

                if (expoStarted || expoFailed) {
                    result = { successful: expoStarted, failed: expoFailed };
                    SmokeTestLogger.info(
                        `Expo launch status patterns found: ${JSON.stringify(result, null, 2)}`,
                    );
                    return true;
                } else {
                    return false;
                }
            };

            await waitUntil(condition, EXPO_APP_LAUNCH_TIMEOUT, 5000);
            if (result) {
                return result;
            } else {
                SmokeTestLogger.info(`Expo launch logging patterns are not found`);
                return { successful: false, failed: false };
            }
        }

        function findExpoURLInLogFile() {
            const match = vscodeManager.findPatternInLogs(
                /exp:\/\/\d+\.\d+\.\d+\.\d+\:\d+/gm,
                SmokeTestsConstants.ReactNativeRunExpoLogFileName,
            );
            if (!match) return null;
            let expoURL = match[0];
            SmokeTestLogger.info(`Found Expo URL: ${expoURL}`);
            return expoURL;
        }

        async function runExpoDebugScenario(
            logFilePath: string,
            testName: string,
            workspacePath: string,
            debugConfigName: string,
            triesToLaunchApp: number,
        ) {
            SmokeTestLogger.info(`${testName}: Starting debugging`);
            // Scan logs only if launch retries provided (Expo Tunnel scenarios)
            if (triesToLaunchApp <= 1) {
                await app.workbench.quickaccess.runDebugScenario(debugConfigName);
            } else {
                for (let retry = 1; retry <= triesToLaunchApp; retry++) {
                    let expoLaunchStatus: ExpoLaunch;
                    await app.workbench.quickaccess.runDebugScenario(debugConfigName);
                    expoLaunchStatus = await findExpoSuccessAndFailurePatterns(
                        logFilePath,
                        ExpoSuccessPattern,
                        ExpoFailurePattern,
                    );
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

        async function expoTest(
            appFileName: string,
            testName: string,
            workspacePath: string,
            debugConfigName: string,
            platform: Platform.AndroidExpo | Platform.iOSExpo,
            triesToLaunchApp: number,
        ) {
            let logFilePath = "";
            app = await vscodeManager.runVSCode(workspacePath, testName);
            SmokeTestLogger.info(`${testName}: ${workspacePath} directory is opened in VS Code`);
            await app.workbench.quickaccess.openFile(appFileName);
            await app.workbench.editors.scrollTop();
            SmokeTestLogger.info(`${testName}: ${appFileName} file is opened`);
            await app.workbench.debug.setBreakpointOnLine(ExpoSetBreakpointOnLine);
            SmokeTestLogger.info(
                `${testName}: Breakpoint is set on line ${ExpoSetBreakpointOnLine}`,
            );
            SmokeTestLogger.info(`${testName}: Chosen debug configuration: ${debugConfigName}`);
            if (process.env.REACT_NATIVE_TOOLS_LOGS_DIR) {
                logFilePath = path.join(
                    process.env.REACT_NATIVE_TOOLS_LOGS_DIR,
                    SmokeTestsConstants.ReactNativeLogFileName,
                );
            } else {
                assert.fail("REACT_NATIVE_TOOLS_LOGS_DIR is not defined");
            }
            await runExpoDebugScenario(
                logFilePath,
                testName,
                workspacePath,
                debugConfigName,
                triesToLaunchApp,
            );

            await app.workbench.editors.waitForTab("Expo QR Code", false, true);
            await app.workbench.editors.waitForActiveTab("Expo QR Code", false, true);
            SmokeTestLogger.info(`${testName}: 'Expo QR Code' tab found`);

            let expoURL = findExpoURLInLogFile();
            if (expoURL === null) {
                assert.fail("Expo URL pattern is not found");
                return;
            }

            if (platform === Platform.iOSExpo) {
                const device = iosSimulatorManager.getSimulator().name;
                let appFile = findFile(SmokeTestsConstants.iOSExpoAppsCacheDir, /.*\.(app)/);
                if (!appFile) {
                    throw new Error(
                        `iOS Expo app is not found in ${SmokeTestsConstants.iOSExpoAppsCacheDir}`,
                    );
                }
                const appPath = path.join(SmokeTestsConstants.iOSExpoAppsCacheDir, appFile);
                const opts = AppiumHelper.prepareAttachOptsForIosApp(device, appPath);
                client = await AppiumHelper.webdriverAttach(opts);
                await AppiumHelper.openExpoApplication(
                    Platform.iOS,
                    client,
                    expoURL,
                    workspacePath,
                    expoFirstLaunch,
                );
                expoFirstLaunch = false;
                SmokeTestLogger.info(
                    `${testName}: Waiting ${SmokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`,
                );
                await sleep(SmokeTestsConstants.expoAppBuildAndInstallTimeout);

                await AppiumHelper.disableExpoErrorRedBox(client);
                await AppiumHelper.disableDevMenuInformationalMsg(client, Platform.iOSExpo);
                await AppiumHelper.enableRemoteDebugJS(client, Platform.iOSExpo);
                await sleep(5 * 1000);
            } else {
                expoURL = expoURL as string;
                const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(
                    EXPO_APP_PACKAGE_NAME,
                    EXPO_APP_ACTIVITY_NAME,
                    androidEmulatorManager.getEmulatorId(),
                );
                client = await AppiumHelper.webdriverAttach(opts);
                // TODO Add listener to trigger that main expo app has been ran
                await AppiumHelper.openExpoApplication(
                    Platform.Android,
                    client,
                    expoURL,
                    workspacePath,
                );
                // TODO Add listener to trigger that child expo app has been ran instead of using timeout
                SmokeTestLogger.info(
                    `${testName}: Waiting ${SmokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`,
                );
                await sleep(SmokeTestsConstants.expoAppBuildAndInstallTimeout);
                await AppiumHelper.disableDevMenuInformationalMsg(client, Platform.AndroidExpo);
                await sleep(2 * 1000);
                await AppiumHelper.enableRemoteDebugJS(client, Platform.AndroidExpo);
                await app.workbench.debug.waitForDebuggingToStart();
            }

            SmokeTestLogger.info(`${testName}: Debugging started`);
            await app.workbench.debug.waitForStackFrame(
                sf => sf.name === appFileName && sf.lineNumber === ExpoSetBreakpointOnLine,
                `looking for ${appFileName} and line ${ExpoSetBreakpointOnLine}`,
            );
            SmokeTestLogger.info(`${testName}: Stack frame found`);
            await app.workbench.debug.stepOver();
            // Wait for debug string to be rendered in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            SmokeTestLogger.info(
                `${testName}: Searching for \"Test output from debuggee\" string in console`,
            );
            let found = await app.workbench.debug.waitForOutput(output =>
                output.some(line => line.indexOf("Test output from debuggee") >= 0),
            );
            assert.notStrictEqual(
                found,
                false,
                '"Test output from debuggee" string is missing in debug console',
            );
            SmokeTestLogger.success(`${testName}: \"Test output from debuggee\" string is found`);
            await app.workbench.debug.disconnectFromDebugger();
            SmokeTestLogger.info(`${testName}: Debugging is stopped`);
        }

        if (testParameters.RunAndroidTests) {
            it("Android Expo app Debug test(Tunnel)", async function () {
                this.timeout(debugExpoTestTime);
                await expoTest(
                    "App.tsx",
                    "Android Expo Debug test(Tunnel)",
                    expoWorkspace,
                    ExpoDebugConfigName,
                    Platform.AndroidExpo,
                    5,
                );
            });

            it("Android Pure RN app Expo test(LAN)", async function () {
                this.timeout(debugExpoTestTime);
                await expoTest(
                    "App.js",
                    "Android pure RN Expo test(LAN)",
                    pureWorkspace,
                    ExpoLanDebugConfigName,
                    Platform.AndroidExpo,
                    1,
                );
            });

            it("Android Expo app Debug test(LAN)", async function () {
                this.timeout(debugExpoTestTime);
                await expoTest(
                    "App.tsx",
                    "Android Expo Debug test(LAN)",
                    expoWorkspace,
                    ExpoLanDebugConfigName,
                    Platform.AndroidExpo,
                    1,
                );
            });

            it("Android Expo app Debug test(localhost)", async function () {
                this.timeout(debugExpoTestTime);
                await expoTest(
                    "App.tsx",
                    "Android Expo Debug test(localhost)",
                    expoWorkspace,
                    ExpoLocalDebugConfigName,
                    Platform.AndroidExpo,
                    1,
                );
            });
        }
        if (process.platform === "darwin" && testParameters.RunIosTests) {
            it("iOS Expo app Debug test(Tunnel)", async function () {
                this.timeout(debugExpoTestTime);
                await expoTest(
                    "App.tsx",
                    "iOS Expo Debug test(Tunnel)",
                    expoWorkspace,
                    ExpoDebugConfigName,
                    Platform.iOSExpo,
                    5,
                );
            });

            it("iOS Pure RN app Expo test(LAN)", async function () {
                this.timeout(debugExpoTestTime);
                await expoTest(
                    "App.js",
                    "iOS pure RN Expo test(LAN)",
                    pureWorkspace,
                    ExpoLanDebugConfigName,
                    Platform.iOSExpo,
                    1,
                );
            });

            it("iOS Expo app Debug test(LAN)", async function () {
                this.timeout(debugExpoTestTime);
                await expoTest(
                    "App.tsx",
                    "iOS Expo Debug test(LAN)",
                    expoWorkspace,
                    ExpoLanDebugConfigName,
                    Platform.iOSExpo,
                    1,
                );
            });

            it("iOS Expo app Debug test(localhost)", async function () {
                this.timeout(debugExpoTestTime);
                await expoTest(
                    "App.tsx",
                    "iOS Expo Debug test(localhost)",
                    expoWorkspace,
                    ExpoLocalDebugConfigName,
                    Platform.iOSExpo,
                    1,
                );
            });
        }
    });
}
