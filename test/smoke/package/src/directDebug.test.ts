// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { Application } from "../../automation";
import AndroidEmulatorManager from "./helpers/androidEmulatorManager";
import { AppiumClient, AppiumHelper, Platform } from "./helpers/appiumHelper";
import AutomationHelper from "./helpers/AutomationHelper";
import IosSimulatorManager from "./helpers/iosSimulatorManager";
import { LaunchConfigurationManager } from "./helpers/launchConfigurationManager";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import TestProject from "./helpers/testProject";
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

export function startDirectDebugTests(
    project: TestProject,
    testParameters: TestRunArguments,
): void {
    describe("Direct debugging", () => {
        let app: Application | null;
        let client: AppiumClient | null;
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
                    await stopPackager();
                    SmokeTestLogger.info("Stopping application ...");
                    await app.stop();
                    app = null;
                }
                if (client) {
                    SmokeTestLogger.info("Closing application ...");
                    await client.closeApp();
                    SmokeTestLogger.info("Deleting session ...");
                    await client.deleteSession();
                    client = null;
                }
                SmokeTestLogger.info("Clearing android application ...");
                AndroidEmulatorManager.closeApp(HERMES_APP_PACKAGE_NAME);
            } catch (error) {
                SmokeTestLogger.error("Error while disposeAll:");
                SmokeTestLogger.error(error);
                // throw error;
            }
        }

        afterEach(disposeAll);

        async function stopPackager() {
            if (app) {
                await automationHelper.runCommandWithRetry(SmokeTestsConstants.stopPackagerCommand);
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
                        // We need to implicitly add target to "Debug iOS" configuration to avoid running additional simulator
                        new LaunchConfigurationManager(
                            project.workspaceDirectory,
                        ).updateLaunchScenario(RNIosHermesDebugConfigName, {
                            target: iosSimulatorManager.getSimulator().name,
                        });
                        break;
                    }
                }

                app = await initApp(project.workspaceDirectory, testname);
                await automationHelper.openFileWithRetry("AppTestButton.js");
                await app.workbench.editors.scrollTop();
                SmokeTestLogger.info(`${testname}: AppTestButton.js file is opened`);
                await app.workbench.debug.setBreakpointOnLine(RNHermesSetBreakpointOnLine);
                SmokeTestLogger.info(
                    `${testname}: Breakpoint is set on line ${RNHermesSetBreakpointOnLine}`,
                );
                SmokeTestLogger.info(`${testname}: Chosen debug configuration: ${debugConfigName}`);
                SmokeTestLogger.info(`${testname}: Starting debugging`);
                await automationHelper.runDebugScenarioWithRetry(debugConfigName);

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
                            `${project.workspaceDirectory}/ios`,
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
                let isHermesWorking = await AppiumHelper.isHermesWorking(client, platform);
                assert.strictEqual(isHermesWorking, true);
                SmokeTestLogger.info(`${testname}: Reattaching to Hermes app`);
                await automationHelper.disconnectFromDebuggerWithRetry();
                await automationHelper.runDebugScenarioWithRetry(RNHermesAttachConfigName);
                SmokeTestLogger.info(`${testname}: Reattached successfully`);
                await sleep(7000);
                SmokeTestLogger.info(`${testname}: Click Test Button`);
                await automationHelper.waitForStackFrameWithRetry(
                    sf =>
                        sf.name === "AppTestButton.js" &&
                        sf.lineNumber === RNHermesSetBreakpointOnLine,
                    `looking for AppTestButton.js and line ${RNHermesSetBreakpointOnLine}`,
                    5,
                    60,
                    1000,
                    async () =>
                        await AppiumHelper.clickTestButtonHermes(
                            client || (await AppiumHelper.webdriverAttach(opts)),
                            platform,
                        ),
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
                await automationHelper.disconnectFromDebuggerWithRetry();
                SmokeTestLogger.info(`${testname}: Debugging is stopped`);
            } catch (e) {
                SmokeTestLogger.error(`${testname} failed: ${e.toString()}`);
                await stopPackager();
                return this.skip();
            }
        }

        if (testParameters.RunAndroidTests) {
            it("Android Hermes app Debug test", async function () {
                this.timeout(hermesTestTime);
                await hermesApplicationTest.call(
                    this,
                    "Android Hermes app Debug test",
                    Platform.Android,
                );
            });
        }

        if (process.platform === "darwin" && testParameters.RunIosTests) {
            it("iOS Hermes app Debug test", async function () {
                this.timeout(hermesTestTime);
                await hermesApplicationTest.call(this, "iOS Hermes app Debug test", Platform.iOS);
            });
        }
    });
}
