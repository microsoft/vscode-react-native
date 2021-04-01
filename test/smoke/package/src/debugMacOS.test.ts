// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as cp from "child_process";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { vscodeManager } from "./main";
import { sleep } from "./helpers/utilities";
import { Application } from "../../automation";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import TestProject from "./helpers/testProject";
import AutomationHelper from "./helpers/AutomationHelper";

const RNmacOSDebugConfigName = "Debug macOS";
const RNmacOSHermesDebugConfigName = "Debug macOS Hermes - Experimental";

const RNmacOSsetBreakpointOnLine = 1;
const RNmacOSHermesSetBreakpointOnLine = 14;

// Time for macOS Debug Test before it reaches timeout
const debugMacOSTestTime = SmokeTestsConstants.macOSTestTimeout;

export function startDebugMacOSTests(
    macosProject: TestProject,
    macosHermesProject: TestProject,
    testParameters: TestRunArguments,
): void {
    describe("Debugging macOS", () => {
        let app: Application;
        let currentMacOSAppName: string = "";
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
            terminateMacOSapp(currentMacOSAppName);
        }

        afterEach(disposeAll);

        function terminateMacOSapp(appName: string): void {
            SmokeTestLogger.info(`*** Searching for ${appName} macOS application process`);
            const searchForMacOSappProcessCommand = `ps -ax | grep ${appName}`;
            const searchResults = cp.execSync(searchForMacOSappProcessCommand).toString();
            // An example of the output from the command above:
            // 40943 ??         4:13.97 node /Users/user/Documents/rn_for_mac_proj/node_modules/.bin/react-native start --port 8081
            // 40959 ??         0:10.36 /Users/user/.nvm/versions/node/v10.19.0/bin/node /Users/user/Documents/rn_for_mac_proj/node_modules/metro/node_modules/jest-worker/build/workers/processChild.js
            // 41004 ??         0:21.34 /Users/user/Library/Developer/Xcode/DerivedData/rn_for_mac_proj-ghuavabiztosiqfqkrityjoxqfmv/Build/Products/Debug/rn_for_mac_proj.app/Contents/MacOS/rn_for_mac_proj
            // 75514 ttys007    0:00.00 grep --color=auto --exclude-dir=.bzr --exclude-dir=CVS --exclude-dir=.git --exclude-dir=.hg --exclude-dir=.svn rn_for_mac_proj
            SmokeTestLogger.info(
                `*** Searching for ${appName} macOS application process: results ${JSON.stringify(
                    searchResults,
                )}`,
            );

            if (searchResults) {
                const processIdRgx = /(^\d*)\s\?\?/g;
                //  We are looking for a process whose path contains the "appName.app" part
                const processData = searchResults
                    .split("\n")
                    .find(str => str.includes(`${appName}.app`));

                if (processData) {
                    const match = processIdRgx.exec(processData);
                    if (match && match[1]) {
                        SmokeTestLogger.info(
                            `*** Terminating ${appName} macOS application process with PID ${match[1]}`,
                        );
                        const terminateMacOSappProcessCommand = `kill ${match[1]}`;
                        cp.execSync(terminateMacOSappProcessCommand);
                    }
                }
            }
        }

        async function macOSApplicationTest(
            testname: string,
            project: TestProject,
            isHermesProject: boolean = false,
        ): Promise<void> {
            app = await initApp(project.workspaceDirectory, testname);
            await automationHelper.openFileWithRetry(project.projectEntryPointFile);
            await app.workbench.editors.scrollTop();
            SmokeTestLogger.info(`${testname}: App.js file is opened`);

            let debugConfigName: string;
            let setBreakpointOnLine: number;
            if (isHermesProject) {
                debugConfigName = RNmacOSHermesDebugConfigName;
                setBreakpointOnLine = RNmacOSHermesSetBreakpointOnLine;
            } else {
                debugConfigName = RNmacOSDebugConfigName;
                setBreakpointOnLine = RNmacOSsetBreakpointOnLine;
            }

            await app.workbench.debug.setBreakpointOnLine(setBreakpointOnLine);
            SmokeTestLogger.info(`${testname}: Breakpoint is set on line ${setBreakpointOnLine}`);
            SmokeTestLogger.info(`${testname}: Chosen debug configuration: ${debugConfigName}`);
            SmokeTestLogger.info(`${testname}: Starting debugging`);
            await automationHelper.runDebugScenarioWithRetry(debugConfigName);
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
            // Wait for our debug string to render in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            SmokeTestLogger.info(
                `${testname}: Searching for "Test output from debuggee" string in console`,
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
            SmokeTestLogger.success(`${testname}: "Test output from debuggee" string is found`);
            await automationHelper.disconnectFromDebuggerWithRetry();
            SmokeTestLogger.info(`${testname}: Debugging is stopped`);
        }

        if (process.platform === "darwin" && testParameters.RunMacOSTests) {
            it("RN macOS app Debug test", async function () {
                this.timeout(debugMacOSTestTime);
                currentMacOSAppName = SmokeTestsConstants.RNmacOSAppName;
                await macOSApplicationTest("RN macOS app Debug test", macosProject);
            });

            if (!testParameters.SkipUnstableTests) {
                it("RN macOS Hermes app Debug test", async function () {
                    this.timeout(debugMacOSTestTime);
                    currentMacOSAppName = SmokeTestsConstants.RNmacOSHermesAppName;
                    await macOSApplicationTest(
                        "RN macOS Hermes app Debug test",
                        macosHermesProject,
                        true,
                    );
                });
            }
        }
    });
}
