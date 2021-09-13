// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as cp from "child_process";
import { sleep, waitUntil } from "./helpers/utilities";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { vscodeManager } from "./main";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { Application } from "../../automation";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import TestProject from "./helpers/testProject";
import AutomationHelper from "./helpers/AutomationHelper";

const RNWDebugConfigName = "Debug RN Wind";
const RNWHermesDebugConfigName = "Debug RN Wind Hermes - Experimental";

const RNwindowsSetBreakpointOnLine = 1;
const RNwindowsHermesSetBreakpointOnLine = 15;

// Time for macOS Debug Test before it reaches timeout
const debugWindowsTestTime = SmokeTestsConstants.windowsTestTimeout;

export function startDebugRNWTests(
    windowsProject: TestProject,
    windowsHermesProject: TestProject,
    testParameters: TestRunArguments,
): void {
    describe("Debugging Windows", () => {
        let app: Application;
        let currentWindowsAppName: string = "";
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
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await stopPackager();
                SmokeTestLogger.info("Stopping application ...");
                await app.stop();
            }
            terminateWindowsApp(currentWindowsAppName);
        }

        afterEach(disposeAll);

        function terminateWindowsApp(appName: string): void {
            SmokeTestLogger.info(`*** Terminating ${appName} Windows application`);
            const terminateWindowsAppCommand = `taskkill/im ${appName}.exe /t /f`;
            cp.execSync(terminateWindowsAppCommand);
        }

        async function stopPackager() {
            if (app) {
                await automationHelper.runCommandWithRetry(SmokeTestsConstants.stopPackagerCommand);
                await sleep(3000);
            }
        }

        async function checkIfAppIsInstalledOnWindows(
            appName: string,
            timeout: number,
        ): Promise<boolean> {
            SmokeTestLogger.info(`Searching for app ${appName} patterns...`);
            const condition = () => {
                return (
                    cp
                        .execSync("tasklist")
                        .toString()
                        .toLowerCase()
                        .indexOf(appName.toLowerCase()) > 0
                );
            };

            const result = await waitUntil(condition, timeout, 5000);
            if (result) {
                SmokeTestLogger.success(`Found launched ${appName}`);
            } else {
                SmokeTestLogger.error(`App ${appName} not found`);
            }
            return result;
        }

        async function windowsApplicationTest(
            testname: string,
            project: TestProject,
            isHermesProject: boolean = false,
        ): Promise<void> {
            try {
                app = await initApp(project.workspaceDirectory, testname);
                await automationHelper.openFileWithRetry(project.projectEntryPointFile);
                await app.workbench.editors.scrollTop();
                SmokeTestLogger.info(`${testname}: App.js file is opened`);

                let debugConfigName: string;
                let setBreakpointOnLine: number;
                if (isHermesProject) {
                    debugConfigName = RNWHermesDebugConfigName;
                    setBreakpointOnLine = RNwindowsHermesSetBreakpointOnLine;
                } else {
                    debugConfigName = RNWDebugConfigName;
                    setBreakpointOnLine = RNwindowsSetBreakpointOnLine;
                }

                await app.workbench.debug.setBreakpointOnLine(setBreakpointOnLine);
                SmokeTestLogger.info(
                    `${testname}: Breakpoint is set on line ${setBreakpointOnLine}`,
                );
                SmokeTestLogger.info(`${testname}: Chosen debug configuration: ${debugConfigName}`);
                SmokeTestLogger.info(`${testname}: Starting debugging`);
                await automationHelper.runDebugScenarioWithRetry(debugConfigName);
                await checkIfAppIsInstalledOnWindows(
                    currentWindowsAppName,
                    SmokeTestsConstants.windowsAppBuildAndInstallTimeout,
                );
                await app.workbench.debug.waitForDebuggingToStart();
                SmokeTestLogger.info(`${testname}: Debugging started`);
                await automationHelper.waitForStackFrameWithRetry(
                    sf =>
                        sf.name === project.projectEntryPointFile &&
                        sf.lineNumber === setBreakpointOnLine,
                    `looking for App.js and line ${setBreakpointOnLine}`,
                );
                SmokeTestLogger.info(`${testname}: Stack frame found`);
                await app.workbench.debug.stepOver();
                // await for our debug string renders in debug console
                await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                SmokeTestLogger.info(
                    `${testname}: Searching for "Test output from debuggee" string in console`,
                );
                await automationHelper.runCommandWithRetry("Debug: Focus on Debug Console View");
                let found = await automationHelper.waitForOutputWithRetry(
                    "Test output from debuggee",
                );
                assert.notStrictEqual(
                    found,
                    false,
                    '"Test output from debuggee" string is missing in debug console',
                );
                SmokeTestLogger.success(`${testname}: "Test output from debuggee" string is found`);
                await automationHelper.disconnectFromDebuggerWithRetry();
                SmokeTestLogger.info(`${testname}: Debugging is stopped`);
            } catch (e) {
                SmokeTestLogger.error(`${testname} failed: ${e.toString()}`);
                await stopPackager();
                return this.skip();
            }
        }

        if (
            process.platform === "win32" &&
            testParameters.RunWindowsTests &&
            !testParameters.SkipUnstableTests
        ) {
            it("RN Windows app Debug test", async function () {
                this.timeout(debugWindowsTestTime);
                currentWindowsAppName = SmokeTestsConstants.RNWAppName;
                await windowsApplicationTest("RN Windows app Debug test", windowsProject);
            });

            it("RN Windows Hermes app Debug test", async function () {
                this.timeout(debugWindowsTestTime);
                currentWindowsAppName = SmokeTestsConstants.RNWHermesAppName;
                await windowsApplicationTest(
                    "RN Windows Hermes app Debug test",
                    windowsHermesProject,
                    true,
                );
            });
        }
    });
}
