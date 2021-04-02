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

const RNwindowsSetBreakpointOnLine = 1;
const RNWDebugConfigName = "Debug RN Wind";

// Time for macOS Debug Test before it reaches timeout
const debugWindowsTestTime = SmokeTestsConstants.windowsTestTimeout;

export function startDebugRNWTests(project: TestProject, testParameters: TestRunArguments): void {
    describe("Debugging Windows", () => {
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
            SmokeTestLogger.info("Dispose all ...");
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await automationHelper.runCommandWithRetry(SmokeTestsConstants.stopPackagerCommand);
                await sleep(3000);
                SmokeTestLogger.info("Stopping application ...");
                await app.stop();
            }
        }

        afterEach(disposeAll);

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

            return waitUntil(condition, timeout, 5000).then((result: boolean) => {
                if (result) {
                    SmokeTestLogger.success(`Found launched ${appName}`);
                } else {
                    SmokeTestLogger.error(`App ${appName} not found`);
                }
                return result;
            });
        }

        if (
            process.platform === "win32" &&
            testParameters.RunWindowsTests &&
            !testParameters.SkipUnstableTests
        ) {
            it("RN Windows app Debug test", async function () {
                try {
                    this.timeout(debugWindowsTestTime);
                    app = await initApp(project.workspaceDirectory, "RN Windows app Debug test");
                    await automationHelper.openFileWithRetry(project.projectEntryPointFile);
                    await app.workbench.editors.scrollTop();
                    SmokeTestLogger.info("Windows Debug test: App.js file is opened");
                    await app.workbench.debug.setBreakpointOnLine(RNwindowsSetBreakpointOnLine);
                    SmokeTestLogger.info(
                        `Windows Debug test: Breakpoint is set on line ${RNwindowsSetBreakpointOnLine}`,
                    );
                    SmokeTestLogger.info(
                        `Windows Debug test: Chosen debug configuration: ${RNWDebugConfigName}`,
                    );
                    SmokeTestLogger.info("Windows Debug test: Starting debugging");
                    await automationHelper.runDebugScenarioWithRetry(RNWDebugConfigName);
                    await checkIfAppIsInstalledOnWindows(
                        SmokeTestsConstants.RNWAppName,
                        SmokeTestsConstants.windowsAppBuildAndInstallTimeout,
                    );
                    await app.workbench.debug.waitForDebuggingToStart();
                    SmokeTestLogger.info("Windows Debug test: Debugging started");
                    await automationHelper.waitForStackFrameWithRetry(
                        sf =>
                            sf.name === project.projectEntryPointFile &&
                            sf.lineNumber === RNwindowsSetBreakpointOnLine,
                        `looking for App.js and line ${RNwindowsSetBreakpointOnLine}`,
                    );
                    SmokeTestLogger.info("Windows Debug test: Stack frame found");
                    await app.workbench.debug.stepOver();
                    // await for our debug string renders in debug console
                    await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                    SmokeTestLogger.info(
                        'Windows Debug test: Searching for "Test output from debuggee" string in console',
                    );
                    await automationHelper.runCommandWithRetry(
                        "Debug: Focus on Debug Console View",
                    );
                    let found = await app.workbench.debug.waitForOutput(output =>
                        output.some(line => line.indexOf("Test output from debuggee") >= 0),
                    );
                    assert.notStrictEqual(
                        found,
                        false,
                        '"Test output from debuggee" string is missing in debug console',
                    );
                    SmokeTestLogger.success(
                        'Windows Debug test: "Test output from debuggee" string is found',
                    );
                    await automationHelper.disconnectFromDebuggerWithRetry();
                    SmokeTestLogger.info("Windows Debug test: Debugging is stopped");
                } catch (e) {
                    SmokeTestLogger.error(`Windows Debug test failed: ${e.toString()}`);
                    await disposeAll();
                    return this.skip();
                }
            });
        }
    });
}
