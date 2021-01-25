// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { Application } from "../../automation";
import { AppiumClient, AppiumHelper, Platform } from "./helpers/appiumHelper";
import IosSimulatorManager from "./helpers/iosSimulatorManager";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import { sleep } from "./helpers/utilities";
import { androidEmulatorManager, iosSimulatorManager, vscodeManager } from "./main";

const HERMES_APP_PACKAGE_NAME = `com.${SmokeTestsConstants.HermesAppName.toLocaleLowerCase()}`;
const HERMES_APP_BUNDLE_ID = `org.reactjs.native.example.${SmokeTestsConstants.HermesAppName}`;
const HERMES_APP_ACTIVITY_NAME = `com.${SmokeTestsConstants.HermesAppName.toLocaleLowerCase()}.MainActivity`;
const RNAndroidHermesDebugConfigName = "Debug Android Hermes - Experimental";
const RNIosHermesDebugConfigName = "Debug iOS Hermes - Experimental";
const RNHermesAttachConfigName = "Attach to Hermes application - Experimental";

const RNHermesSetBreakpointOnLine = 11;
// Time for Android Debug Test before it reaches timeout
const hermesTestTime = SmokeTestsConstants.hermesTestTimeout;

export function startDirectDebugTests(workspace: string, testParameters: TestRunArguments): void {
    describe("Direct debugging", () => {
        let app: Application | null;
        let client: AppiumClient | null;

        async function disposeAll() {
            SmokeTestLogger.info("Dispose all ...");
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await stopPackager();
                await app.stop();
                app = null;
            }
            if (client) {
                await client.closeApp();
                await client.deleteSession();
                client = null;
            }
        }

        afterEach(disposeAll);

        async function stopPackager() {
            if (app) {
                await app.workbench.quickaccess.runCommand(SmokeTestsConstants.stopPackagerCommand);
                await sleep(3000);
            }
        }

        async function hermesApplicationTest(testname: string, platform: Platform) {
            try {
                if (platform !== Platform.Android && platform !== Platform.iOS) {
                    return assert.fail(`Passed unsupported platform: ${platform}`);
                }

                let debugConfigName: string;
                switch (platform) {
                    case Platform.Android: {
                        debugConfigName = RNAndroidHermesDebugConfigName;
                        break;
                    }
                    case Platform.iOS: {
                        debugConfigName = RNIosHermesDebugConfigName;
                        break;
                    }
                }

                app = await vscodeManager.runVSCode(workspace, testname);
                await app.workbench.quickaccess.openFile("AppTestButton.js");
                await app.workbench.editors.scrollTop();
                SmokeTestLogger.info(`${testname}: AppTestButton.js file is opened`);
                await app.workbench.debug.setBreakpointOnLine(RNHermesSetBreakpointOnLine);
                SmokeTestLogger.info(
                    `${testname}: Breakpoint is set on line ${RNHermesSetBreakpointOnLine}`,
                );
                SmokeTestLogger.info(`${testname}: Chosen debug configuration: ${debugConfigName}`);
                SmokeTestLogger.info(`${testname}: Starting debugging`);
                await app.workbench.quickaccess.runDebugScenario(debugConfigName);

                let opts: any;
                switch (platform) {
                    case Platform.Android: {
                        opts = AppiumHelper.prepareAttachOptsForAndroidActivity(
                            HERMES_APP_PACKAGE_NAME,
                            HERMES_APP_ACTIVITY_NAME,
                            androidEmulatorManager.getEmulatorId(),
                        );
                        await androidEmulatorManager.waitUntilAppIsInstalled(
                            HERMES_APP_PACKAGE_NAME,
                        );
                        break;
                    }
                    case Platform.iOS: {
                        const buildPath = IosSimulatorManager.getIOSBuildPath(
                            `${workspace}/ios`,
                            `${SmokeTestsConstants.HermesAppName}.xcworkspace`,
                            "Debug",
                            SmokeTestsConstants.HermesAppName,
                            "iphonesimulator",
                        );
                        const appPath = `${buildPath}/${SmokeTestsConstants.HermesAppName}.app`;
                        opts = AppiumHelper.prepareAttachOptsForIosApp(
                            iosSimulatorManager.getSimulator().name,
                            appPath,
                        );
                        await iosSimulatorManager.waitUntilIosAppIsInstalled(HERMES_APP_BUNDLE_ID);
                        break;
                    }
                }

                client = await AppiumHelper.webdriverAttach(opts);
                await app.workbench.debug.waitForDebuggingToStart();
                SmokeTestLogger.info(`${testname}: Debugging started`);
                SmokeTestLogger.info(`${testname}: Checking for Hermes mark`);
                let isHermesWorking = await AppiumHelper.isHermesWorking(client);
                assert.strictEqual(isHermesWorking, true);
                SmokeTestLogger.info(`${testname}: Reattaching to Hermes app`);
                await app.workbench.debug.disconnectFromDebugger();
                await app.workbench.quickaccess.runDebugScenario(RNHermesAttachConfigName);
                SmokeTestLogger.info(`${testname}: Reattached successfully`);
                await sleep(7000);
                SmokeTestLogger.info(`${testname}: Click Test Button`);
                await AppiumHelper.clickTestButtonHermes(client);
                await app.workbench.debug.waitForStackFrame(
                    sf =>
                        sf.name === "AppTestButton.js" &&
                        sf.lineNumber === RNHermesSetBreakpointOnLine,
                    `looking for AppTestButton.js and line ${RNHermesSetBreakpointOnLine}`,
                );
                SmokeTestLogger.info(`${testname}: Stack frame found`);
                await app.workbench.debug.continue();
                // await for our debug string renders in debug console
                await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                let found = vscodeManager.findStringInLogs(
                    "Test output from Hermes debuggee",
                    SmokeTestsConstants.ReactNativeLogFileName,
                );
                assert.notStrictEqual(
                    found,
                    false,
                    '"Test output from Hermes debuggee" string is missing in output file',
                );
                if (found) {
                    SmokeTestLogger.success(
                        `${testname}: "Test output from Hermes debuggee" string is found`,
                    );
                }
                await app.workbench.debug.disconnectFromDebugger();
                SmokeTestLogger.info(`${testname}: Debugging is stopped`);
            } catch (e) {
                SmokeTestLogger.error(`${testname} failed: ${e.toString()}`);
                await stopPackager();
                return this.skip();
            }
        }

        afterEach(disposeAll);

        if (testParameters.RunAndroidTests) {
            it("Android Hermes app Debug test", async function () {
                this.timeout(hermesTestTime);
                await hermesApplicationTest("Android Hermes app Debug test", Platform.Android);
            });
        }

        if (process.platform === "darwin" && testParameters.RunIosTests) {
            it("iOS Hermes app Debug test", async function () {
                this.timeout(hermesTestTime);
                await hermesApplicationTest("iOS Hermes app Debug test", Platform.iOS);
            });
        }
    });
}
