// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { sleep } from "./helpers/utilities";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { RNWWorkspacePath, runVSCode } from "./main";

import { TestRunArguments } from "./helpers/configHelper";
import { Application } from "../../automation";

const RNSetBreakpointOnLine = 1;
const RNDebugConfigName = "Debug Windows";

export function setup(testParameters?: TestRunArguments): void {
    describe("Debugging Windows", () => {
        let app: Application;
        console.log(testParameters);

        async function disposeAll() {
            if (app) {
                await app.stop();
            }
        }

        afterEach(disposeAll);

        it("RN app Debug test", async function () {
            this.timeout(SmokeTestsConstants.windowsAppBuildAndInstallTimeout);
            app = await runVSCode(RNWWorkspacePath);
            await app.workbench.quickaccess.openFile("App.js");
            await app.workbench.editors.scrollTop();
            console.log("Windows Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(RNSetBreakpointOnLine);
            console.log(`Windows Debug test: Breakpoint is set on line ${RNSetBreakpointOnLine}`);
            console.log(`Windows Debug test: Chosen debug configuration: ${RNDebugConfigName}`);
            console.log("Windows Debug test: Starting debugging");
            await app.workbench.quickaccess.runDebugScenario(RNDebugConfigName);
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("Windows Debug test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === RNSetBreakpointOnLine, `looking for App.js and line ${RNSetBreakpointOnLine}`);
            console.log("Windows Debug test: Stack frame found");
            await app.workbench.debug.stepOver();
            // await for our debug string renders in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            console.log("Windows Debug test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
            console.log(found);
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            console.log("Windows Debug test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.disconnectFromDebugger();
            console.log("Windows Debug test: Debugging is stopped");
        });
    });
}
