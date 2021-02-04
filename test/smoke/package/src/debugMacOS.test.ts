// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { MacOSTestHelper } from "./helpers/macOSTestHelper";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { vscodeManager } from "./main";
import { sleep } from "./helpers/utilities";
import { Application } from "../../automation";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { TestRunArguments } from "./helpers/testConfigProcessor";

const RNmacOSDebugConfigName = "Debug macOS";

const RNmacOSsetBreakpointOnLine = 1;

// Time for macOS Debug Test before it reaches timeout
const debugMacOSTestTime = SmokeTestsConstants.macOSTestTimeout;

export function startDebugMacOSTests(
    macosWorkspace: string,
    macosHermesWorkspace: string,
    testParameters: TestRunArguments,
): void {
    describe("Debugging macOS", () => {
        let app: Application;

        async function disposeAll() {
            SmokeTestLogger.info("Dispose all ...");
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await app.workbench.quickaccess.runCommand(SmokeTestsConstants.stopPackagerCommand);
                await sleep(3000);
                await app.stop();
            }
            MacOSTestHelper.terminateMacOSapp(SmokeTestsConstants.RNmacOSAppName);
        }

        afterEach(disposeAll);

        async function macOSApplicationTest(testname: string, workspace: string) {
            app = await vscodeManager.runVSCode(workspace, testname);
            await app.workbench.quickaccess.openFile("App.js");
            await app.workbench.editors.scrollTop();
            SmokeTestLogger.info(`${testname}: App.js file is opened`);
            await app.workbench.debug.setBreakpointOnLine(RNmacOSsetBreakpointOnLine);
            SmokeTestLogger.info(
                `${testname}: Breakpoint is set on line ${RNmacOSsetBreakpointOnLine}`,
            );
            SmokeTestLogger.info(
                `${testname}: Chosen debug configuration: ${RNmacOSDebugConfigName}`,
            );
            SmokeTestLogger.info(`${testname}: Starting debugging`);
            await app.workbench.quickaccess.runDebugScenario(RNmacOSDebugConfigName);
            await app.workbench.debug.waitForDebuggingToStart();
            SmokeTestLogger.info(`${testname}: Debugging started`);
            await app.workbench.debug.waitForStackFrame(
                sf => sf.name === "App.js" && sf.lineNumber === RNmacOSsetBreakpointOnLine,
                `looking for App.js and line ${RNmacOSsetBreakpointOnLine}`,
            );
            SmokeTestLogger.info(`${testname}: Stack frame found`);
            await app.workbench.debug.stepOver();
            // Wait for our debug string to render in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            SmokeTestLogger.info(
                `${testname}: Searching for "Test output from debuggee" string in console`,
            );
            let found = await app.workbench.debug.waitForOutput(output =>
                output.some(line => line.indexOf("Test output from debuggee") >= 0),
            );
            assert.notStrictEqual(
                found,
                false,
                '"Test output from debuggee" string is missing in debug console',
            );
            SmokeTestLogger.success(`${testname}: "Test output from debuggee" string is found`);
            await app.workbench.debug.disconnectFromDebugger();
            SmokeTestLogger.info(`${testname}: Debugging is stopped`);
        }

        if (process.platform === "darwin" && testParameters.RunMacOSTests) {
            it("RN macOS app Debug test", async function () {
                this.timeout(debugMacOSTestTime);
                await macOSApplicationTest("RN macOS app Debug test", macosWorkspace);
            });

            it("RN macOS Hermes app Debug test", async function () {
                this.timeout(debugMacOSTestTime);
                await macOSApplicationTest("RN macOS Hermes app Debug test", macosHermesWorkspace);
            });
        }
    });
}
