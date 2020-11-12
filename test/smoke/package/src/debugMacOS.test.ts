// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { RNmacOSworkspacePath, runVSCode } from "./main";
import { sleep } from "./helpers/utilities";
import { SetupEnvironmentHelper } from "./helpers/setupEnvironmentHelper";
import { TestRunArguments } from "./helpers/configHelper";
import { Application } from "../../automation";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";

const RNmacOSDebugConfigName = "Debug macOS";

const RNmacOSsetBreakpointOnLine = 1;

// Time for macOS Debug Test before it reaches timeout
const debugMacOSTestTime = SmokeTestsConstants.macOSAppBuildAndInstallTimeout + 100 * 1000;

export function setup(testParameters?: TestRunArguments): void {
    describe("Debugging macOS", () => {
        let app: Application;

        async function disposeAll() {
            if (app) {
                await app.stop();
            }
            SetupEnvironmentHelper.terminateMacOSapp(SmokeTestsConstants.RNmacOSAppName);
        }

        afterEach(disposeAll);

        it("RN macOS app Debug test", async function () {
            this.timeout(debugMacOSTestTime);
            app = await runVSCode(RNmacOSworkspacePath);
            await app.workbench.quickaccess.openFile("App.js");
            await app.workbench.editors.scrollTop();
            SmokeTestLogger.info("macOS Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(RNmacOSsetBreakpointOnLine);
            SmokeTestLogger.info(`macOS Debug test: Breakpoint is set on line ${RNmacOSsetBreakpointOnLine}`);
            SmokeTestLogger.info(`macOS Debug test: Chosen debug configuration: ${RNmacOSDebugConfigName}`);
            SmokeTestLogger.info("macOS Debug test: Starting debugging");
            await app.workbench.quickaccess.runDebugScenario(RNmacOSDebugConfigName);
            await app.workbench.debug.waitForDebuggingToStart();
            SmokeTestLogger.info("macOS Debug test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === RNmacOSsetBreakpointOnLine, `looking for App.js and line ${RNmacOSsetBreakpointOnLine}`);
            SmokeTestLogger.info("macOS Debug test: Stack frame found");
            await app.workbench.debug.stepOver();
            // Wait for our debug string to render in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            SmokeTestLogger.info("macOS Debug test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            SmokeTestLogger.success("macOS Debug test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.disconnectFromDebugger();
            SmokeTestLogger.info("macOS Debug test: Debugging is stopped");
        });
    });
}
