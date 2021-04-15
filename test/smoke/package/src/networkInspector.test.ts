// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import * as cp from "child_process";
import { Application } from "../../automation";
import AndroidEmulatorManager from "./helpers/androidEmulatorManager";
import { AppiumClient, AppiumHelper, Platform } from "./helpers/appiumHelper";
import IosSimulatorManager from "./helpers/iosSimulatorManager";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import { sleep, findStringInFileWithTimeout } from "./helpers/utilities";
import { androidEmulatorManager, iosSimulatorManager, vscodeManager } from "./main";

const RunNetworkInspectorCommand = "Run Network Inspector";
// const StopNetworkInspectorCommand = "Stop Network Inspector";
const RunAndroidOnEmulatorCommand = "Run Android on Emulator";

const HERMES_APP_PACKAGE_NAME = `com.${SmokeTestsConstants.HermesAppName.toLocaleLowerCase()}`;
const HERMES_APP_BUNDLE_ID = `org.reactjs.native.example.${SmokeTestsConstants.HermesAppName}`;
const HERMES_APP_ACTIVITY_NAME = `com.${SmokeTestsConstants.HermesAppName.toLocaleLowerCase()}.MainActivity`;

const NI_FIND_PATTERN_TIMEOUT = 30000;
const NIDeviceConnectedPattern = "Device connected";
const ExpressServerPort = 7321;

export function startNetworkInspectorTests(
    rnHermesWorkspace: string,
    testParameters?: TestRunArguments,
): void {
    describe("Network inspector tests", () => {
        const expressServerWorkspace = path.join(
            rnHermesWorkspace,
            SmokeTestsConstants.ExpressServerDir,
        );

        let app: Application;
        let client: AppiumClient | null;
        let expressServerProcess: cp.ChildProcess | null;

        async function disposeAll() {
            SmokeTestLogger.info("Dispose all ...");
            if (expressServerProcess) {
                expressServerProcess.kill();
                expressServerProcess = null;
            }
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await app.workbench.quickaccess.runCommand(SmokeTestsConstants.stopPackagerCommand);
                await sleep(3000);
                await app.stop();
            }
            if (client) {
                SmokeTestLogger.info("Closing application ...");
                await client.closeApp();
                SmokeTestLogger.info("Deleting session ...");
                await client.deleteSession();
                client = null;
            }
        }

        afterEach(disposeAll);

        function startExpressServer() {
            expressServerProcess = cp.spawn("node", [SmokeTestsConstants.ExpressServerFileName], {
                cwd: expressServerWorkspace,
            });
        }

        async function networkInspectorTest(testname: string, platform: Platform) {
            if (platform !== Platform.Android && platform !== Platform.iOS) {
                return assert.fail(`Passed unsupported platform: ${platform}`);
            }

            app = await vscodeManager.runVSCode(rnHermesWorkspace, testname);
            SmokeTestLogger.info(
                `${testname}: Launching an Android emulator via the command ${RunAndroidOnEmulatorCommand}`,
            );
            await app.workbench.quickaccess.runCommand(RunAndroidOnEmulatorCommand);
            SmokeTestLogger.info(`${testname}: Wait until emulator starting`);
            await androidEmulatorManager.waitUntilEmulatorStarting();

            let appiumOpts: any;
            switch (platform) {
                case Platform.Android: {
                    appiumOpts = AppiumHelper.prepareAttachOptsForAndroidActivity(
                        HERMES_APP_PACKAGE_NAME,
                        HERMES_APP_ACTIVITY_NAME,
                        androidEmulatorManager.getEmulatorId(),
                    );
                    await androidEmulatorManager.waitUntilAppIsInstalled(HERMES_APP_PACKAGE_NAME);
                    break;
                }
                case Platform.iOS: {
                    const buildPath = IosSimulatorManager.getIOSBuildPath(
                        `${rnHermesWorkspace}/ios`,
                        `${SmokeTestsConstants.HermesAppName}.xcworkspace`,
                        "Debug",
                        SmokeTestsConstants.HermesAppName,
                        "iphonesimulator",
                    );
                    const appPath = `${buildPath}/${SmokeTestsConstants.HermesAppName}.app`;
                    appiumOpts = AppiumHelper.prepareAttachOptsForIosApp(
                        iosSimulatorManager.getSimulator().name,
                        appPath,
                    );
                    await iosSimulatorManager.waitUntilIosAppIsInstalled(HERMES_APP_BUNDLE_ID);
                    break;
                }
            }

            client = await AppiumHelper.webdriverAttach(appiumOpts);

            SmokeTestLogger.info(`${testname}: Starting Express server`);
            startExpressServer();
            sleep(2000);

            AndroidEmulatorManager.adbReversePort(ExpressServerPort);
            SmokeTestLogger.info(`${testname}: Starting Network inspector`);
            await app.workbench.quickaccess.runCommand(RunNetworkInspectorCommand);
            let logFilePath = "";
            if (process.env.REACT_NATIVE_TOOLS_LOGS_DIR) {
                logFilePath = path.join(
                    process.env.REACT_NATIVE_TOOLS_LOGS_DIR,
                    SmokeTestsConstants.NetworkInspectorLogFileName,
                );
            } else {
                return assert.fail("REACT_NATIVE_TOOLS_LOGS_DIR is not defined");
            }
            const deviceConnectedFound = await findStringInFileWithTimeout(
                logFilePath,
                NIDeviceConnectedPattern,
                NI_FIND_PATTERN_TIMEOUT,
            );
            if (!deviceConnectedFound) {
                return assert.fail(`Couldn't find a connected device`);
            }
            SmokeTestLogger.info(
                `${testname}: an Android emulator is connected to the Network inspector`,
            );
            await sleep(2000);
            SmokeTestLogger.info(`${testname}: Click Test Network Button`);
            await AppiumHelper.clickTestNetworkButton(client, platform);

            sleep(20000);
        }

        // Android tests
        if (!testParameters || testParameters.RunAndroidTests) {
            it("Network inspector should process GET and POST requests on an Android emulator", async function () {
                this.timeout(SmokeTestsConstants.networkInspectorTestTimeout);
                await networkInspectorTest.call(
                    this,
                    "Network inspector Android test",
                    Platform.Android,
                );
            });
        }

        // iOS tests
        if (process.platform === "darwin" && (!testParameters || testParameters.RunIosTests)) {
        }
    });
}
