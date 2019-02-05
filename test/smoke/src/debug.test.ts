// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SpectronApplication } from "./spectron/application";
import * as assert from "assert";

export function setup() {
    describe("Debug", () => {
        before(async function () {
            const app = this.app as SpectronApplication;
            app.suiteName = "Debug";
        });

        it("Android Debug test", async function () {
            this.timeout(150000);
            const app = this.app as SpectronApplication;
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.runCommand("cursorTop");
            console.log("Android Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(23);
            console.log("Android Debug test: Breakpoint is set on line 23");
            await app.workbench.debug.openDebugViewlet();
            await app.workbench.debug.startDebugging();
            console.log("Android Debug test: debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === 23, "looking for App.js and line 23");
            console.log("Android Debug test: stack frame found");
            await app.workbench.debug.continue();
            // await for our debug string renders in debug console
            await new Promise(resolve => setTimeout(resolve, 500));
            let result = await app.workbench.debug.getConsoleOutput();
            let testOutputIndex = result.indexOf("Test output from debuggee");
            assert.notStrictEqual(testOutputIndex, -1, "\"Test output from debuggee\" string is not contains in debug console");
            await app.workbench.debug.stopDebugging();
        });

    });
}