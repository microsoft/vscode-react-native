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
            await app.workbench.debug.setBreakpointOnLine(23);
            await app.workbench.debug.openDebugViewlet();
            await app.workbench.debug.startDebugging();
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === 23, "looking for App.js and line 0");
            await app.workbench.debug.continue();
            let result = await app.workbench.debug.getConsoleOutput();
            let testOutputIndex = result.indexOf("Test output from debuggee");
            assert.notStrictEqual(testOutputIndex, -1, "\"Test output from debuggee\" string contains in debug console");
        });

    });
}