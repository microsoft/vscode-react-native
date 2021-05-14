// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import * as cp from "child_process";
import { Application } from "../../automation";
import AndroidEmulatorManager from "./helpers/androidEmulatorManager";
import TestProject from "./helpers/testProject";
import { AppiumClient, AppiumHelper, Platform } from "./helpers/appiumHelper";
import IosSimulatorManager from "./helpers/iosSimulatorManager";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import {
    sleep,
    findStringInFileWithTimeout,
    retrieveStringsFromLogFileWithTimeout,
} from "./helpers/utilities";
import { androidEmulatorManager, iosSimulatorManager, vscodeManager } from "./main";
import AutomationHelper from "./helpers/AutomationHelper";

const RunNetworkInspectorCommand = "Run Network Inspector";
const StopNetworkInspectorCommand = "Stop Network Inspector";
const RunAndroidOnEmulatorCommand = "Run Android on Emulator";
const RunIOSOnSimulatorCommand = "Run iOS on Simulator";

const HERMES_APP_PACKAGE_NAME = `com.${SmokeTestsConstants.HermesAppName.toLocaleLowerCase()}`;
const HERMES_APP_BUNDLE_ID = `org.reactjs.native.example.${SmokeTestsConstants.HermesAppName}`;
const HERMES_APP_ACTIVITY_NAME = `com.${SmokeTestsConstants.HermesAppName.toLocaleLowerCase()}.MainActivity`;

const NI_FIND_PATTERN_TIMEOUT = 30000;
const NIDeviceConnectedPattern = "Device connected";
const ExpressServerPort = 7321;
const TestNetworkButtonName = "Test Network Button";

const requestPattern = /%cNetwork request:(.*?)\scolor: #0000ff\s\{(.*?)\}\s\}/gs;

export function startNetworkInspectorTests(
    project: TestProject,
    testParameters?: TestRunArguments,
): void {
    describe("Network inspector tests", () => {
        const expressServerWorkspace = path.join(
            project.workspaceDirectory,
            SmokeTestsConstants.ExpressServerDir,
        );

        let app: Application;
        let client: AppiumClient | null;
        let expressServerProcess: cp.ChildProcess | null;
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
            SmokeTestLogger.info("Dispose all ...");
            if (expressServerProcess) {
                expressServerProcess.kill();
                expressServerProcess = null;
            }
            SmokeTestLogger.info("Stopping Network inspector");
            await automationHelper.runCommandWithRetry(StopNetworkInspectorCommand);
            await sleep(3000);
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await automationHelper.runCommandWithRetry(SmokeTestsConstants.stopPackagerCommand);
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

        function validatePostRequestResult(postRequestData: string): boolean {
            const requestTitle = "POST localhost:7321/post_sample";
            const requestBodyStr =
                '  "Request Body": {\n    "testStr": "test",\n    "testObj": {\n      "testNum": 1234,\n      "testStr1": "test1"\n    }\n  }';
            const responseBodyStr =
                '  "Response Body": {\n    "testStr": "testSuccess",\n    "testNun": 123,\n    "testArr": [\n      1,\n      2\n    ]\n  }';
            const requestHeadersPattern = /"Request Headers".*?"Content-Type": "application\/json; charset=utf-8".*?\}/s;
            const responseHeadersPattern = /"Response Headers".*?"Content-Type": "application\/json; charset=utf-8".*?\}/s;

            return (
                postRequestData.includes(requestTitle) &&
                postRequestData.includes(requestBodyStr) &&
                postRequestData.includes(responseBodyStr) &&
                requestHeadersPattern.test(postRequestData) &&
                responseHeadersPattern.test(postRequestData)
            );
        }

        function validateGetRequestResult(getRequestData: string): boolean {
            const requestTitle = "GET localhost:7321/get_sample";
            const requestQueryParameters =
                '  "Request Query Parameters": {\n    "param1": "test",\n    "param2": "123"\n  }';
            const responseBodyStr = '  "Response Body": "GET request success: testSuccess"';
            const responseHeadersPattern = /"Response Headers".*?"Content-Type": "text\/html; charset=utf-8".*?\}/s;

            return (
                getRequestData.includes(requestTitle) &&
                getRequestData.includes(requestQueryParameters) &&
                getRequestData.includes(responseBodyStr) &&
                responseHeadersPattern.test(getRequestData)
            );
        }

        async function networkInspectorTest(testname: string, platform: Platform) {
            if (platform !== Platform.Android && platform !== Platform.iOS) {
                return assert.fail(`Passed unsupported platform: ${platform}`);
            }

            app = await initApp(project.workspaceDirectory, testname);
            const runApplicationCommand =
                platform === Platform.Android
                    ? RunAndroidOnEmulatorCommand
                    : RunIOSOnSimulatorCommand;
            SmokeTestLogger.info(
                `${testname}: Launching the application on an ${platform} emulator via the command ${runApplicationCommand}`,
            );
            await automationHelper.runCommandWithRetry(runApplicationCommand);
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
                        `${project.workspaceDirectory}/ios`,
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
            await sleep(2000);

            AndroidEmulatorManager.adbReversePort(ExpressServerPort);
            SmokeTestLogger.info(`${testname}: Starting Network inspector`);
            await automationHelper.runCommandWithRetry(RunNetworkInspectorCommand);
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
                `${testname}: an ${platform} emulator is connected to the Network inspector`,
            );
            await AppiumHelper.clickTestButton(client, TestNetworkButtonName, platform);
            SmokeTestLogger.info(
                `${testname}: searching for the post request pattern in Network inspector log file...`,
            );
            const requestResults = await retrieveStringsFromLogFileWithTimeout(
                logFilePath,
                requestPattern,
                NI_FIND_PATTERN_TIMEOUT,
            );
            if (!requestResults || requestResults.length < 2) {
                return assert.fail(`Couldn't find request data in logs`);
            }
            SmokeTestLogger.info(
                `${testname}: logged Network request ${requestResults.toString()}`,
            );
            assert.strictEqual(validatePostRequestResult(requestResults[0]), true);
            assert.strictEqual(validateGetRequestResult(requestResults[1]), true);
            SmokeTestLogger.success(`${testname}: logged Network request is correct`);
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
            it("Network inspector should process GET and POST requests on an iOS emulator", async function () {
                this.timeout(SmokeTestsConstants.networkInspectorTestTimeout);
                await networkInspectorTest.call(this, "Network inspector iOS test", Platform.iOS);
            });
        }
    });
}
