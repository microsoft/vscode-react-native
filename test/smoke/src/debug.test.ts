// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SpectronApplication } from "./spectron/application";

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
            await app.workbench.debug.continue();
        });

    });
}