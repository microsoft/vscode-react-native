// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { Application } from "../../automation";
import AndroidEmulatorManager from "./helpers/androidEmulatorManager";
import AutomationHelper from "./helpers/AutomationHelper";
import { LaunchConfigurationManager } from "./helpers/launchConfigurationManager";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import TestProject from "./helpers/testProject";
import { sleep } from "./helpers/utilities";
import { androidEmulatorManager, iosSimulatorManager, vscodeManager } from "./main";

const RN_APP_PACKAGE_NAME = "com.latestrnapp";
const AndroidRNDebugConfigName = "Debug Android";

const RnAppBundleId = "org.reactjs.native.example.latestRNApp";
const IosRNDebugConfigName = "Debug classic iOS";

const RNSetBreakpointOnLine = 1;

// Time for Android Debug Test before it reaches timeout
const debugAndroidTestTime = SmokeTestsConstants.androidTestTimeout;
// Time for iOS Debug Test before it reaches timeout
const debugIosTestTime = SmokeTestsConstants.iosTestTimeout;

export function startReactNativeTests(
    project: TestProject,
    testParameters: TestRunArguments,
): void {
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

        // Android debug tests
        if (testParameters.RunAndroidTests || testParameters.RunBasicTests) {
            it("Android RN app Debug test", async function () {
                this.timeout(debugAndroidTestTime);
                app = await initApp(project.workspaceDirectory, "Android RN app Debug test");
                await automationHelper.openFileWithRetry(project.projectEntryPointFile);
                await app.workbench.editors.scrollTop();
                SmokeTestLogger.info("Android Debug test: App.js file is opened");
                await app.workbench.debug.setBreakpointOnLine(RNSetBreakpointOnLine);
                SmokeTestLogger.info(
                    `Android Debug test: Breakpoint is set on line ${RNSetBreakpointOnLine}`,
                );
                SmokeTestLogger.info(
                    `Android Debug test: Chosen debug configuration: ${AndroidRNDebugConfigName}`,
                );
                SmokeTestLogger.info("Android Debug test: Starting debugging");
                await automationHelper.runDebugScenarioWithRetry(AndroidRNDebugConfigName);
                await androidEmulatorManager.waitUntilAppIsInstalled(RN_APP_PACKAGE_NAME);
                await app.workbench.debug.waitForDebuggingToStart();
                SmokeTestLogger.info("Android Debug test: Debugging started");
                await automationHelper.waitForStackFrameWithRetry(
                    sf =>
                        sf.name === project.projectEntryPointFile &&
                        sf.lineNumber === RNSetBreakpointOnLine,
                    `looking for App.js and line ${RNSetBreakpointOnLine}`,
                );
                SmokeTestLogger.info("Android Debug test: Stack frame found");
                await app.workbench.debug.stepOver();
                // await for our debug string renders in debug console
                await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                SmokeTestLogger.info(
                    'Android Debug test: Searching for "Test output from debuggee" string in console',
                );
                await automationHelper.runCommandWithRetry("Debug: Focus on Debug Console View");
                let found = await app.workbench.debug.waitForOutput(output =>
                    output.some(line => line.indexOf("Test output from debuggee") >= 0),
                );
                assert.notStrictEqual(
                    found,
                    false,
                    '"Test output from debuggee" string is missing in debug console',
                );
                SmokeTestLogger.success(
                    'Android Debug test: "Test output from debuggee" string is found',
                );
                await automationHelper.disconnectFromDebuggerWithRetry();
                SmokeTestLogger.info("Android Debug test: Debugging is stopped");
            });
        }

        // iOS debug tests
        if (
            process.platform === "darwin" &&
            (testParameters.RunIosTests || testParameters.RunBasicTests)
        ) {
            it("iOS RN app Debug test", async function () {
                if (process.platform !== "darwin") {
                    SmokeTestLogger.info(
                        `iOS RN app Debug test: skip test if running not on macOS`,
                    );
                    return this.skip();
                }
                this.timeout(debugIosTestTime);
                const launchConfigurationManager = new LaunchConfigurationManager(
                    project.workspaceDirectory,
                );
                const deviceName = iosSimulatorManager.getSimulator().name;
                app = await initApp(project.workspaceDirectory, "iOS RN app Debug test");
                await automationHelper.openFileWithRetry(project.projectEntryPointFile);
                await app.workbench.editors.scrollTop();
                SmokeTestLogger.info("iOS Debug test: App.js file is opened");
                await app.workbench.debug.setBreakpointOnLine(RNSetBreakpointOnLine);
                SmokeTestLogger.info(
                    `iOS Debug test: Breakpoint is set on line ${RNSetBreakpointOnLine}`,
                );
                SmokeTestLogger.info(
                    `iOS Debug test: Chosen debug configuration: ${IosRNDebugConfigName}`,
                );
                // We need to implicitly add target to "Debug iOS" configuration to avoid running additional simulator
                launchConfigurationManager.updateLaunchScenario(IosRNDebugConfigName, {
                    target: deviceName,
                });
                SmokeTestLogger.info("iOS Debug test: Starting debugging");
                await automationHelper.runDebugScenarioWithRetry(IosRNDebugConfigName);
                await iosSimulatorManager.waitUntilIosAppIsInstalled(RnAppBundleId);
                await app.workbench.debug.waitForDebuggingToStart();
                SmokeTestLogger.info("iOS Debug test: Debugging started");
                await automationHelper.waitForStackFrameWithRetry(
                    sf =>
                        sf.name === project.projectEntryPointFile &&
                        sf.lineNumber === RNSetBreakpointOnLine,
                    `looking for App.js and line ${RNSetBreakpointOnLine}`,
                );
                SmokeTestLogger.info("iOS Debug test: Stack frame found");
                await app.workbench.debug.stepOver();
                // Wait for our debug string to render in debug console
                await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                SmokeTestLogger.info(
                    'iOS Debug test: Searching for "Test output from debuggee" string in console',
                );
                await automationHelper.runCommandWithRetry("Debug: Focus on Debug Console View");
                let found = await app.workbench.debug.waitForOutput(output =>
                    output.some(line => line.indexOf("Test output from debuggee") >= 0),
                );
                assert.notStrictEqual(
                    found,
                    false,
                    '"Test output from debuggee" string is missing in debug console',
                );
                SmokeTestLogger.success(
                    'iOS Debug test: "Test output from debuggee" string is found',
                );
                await automationHelper.disconnectFromDebuggerWithRetry();
                SmokeTestLogger.info("iOS Debug test: Debugging is stopped");
            });
        }
    });
}
