/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SpectronApplication } from "../../spectron/application";

export function setup() {
    describe("Debug", () => {
        before(async function () {
            const app = this.app as SpectronApplication;
            app.suiteName = "Debug";
        });

        it("Android Debug test", async function () {
            const app = this.app as SpectronApplication;
            // await app.restart({workspaceOrFolder: app.workspacePath});
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("app.js");
            await app.workbench.debug.setBreakpointOnLine(23);
            await app.workbench.debug.openDebugViewlet();
            await app.workbench.debug.startDebugging();
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "app.js" && sf.lineNumber === 23, "Looking for BP on Return line 23");
            await app.workbench.debug.continue();
        });

    });
}