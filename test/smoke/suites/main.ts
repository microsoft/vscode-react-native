// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { startSmokeTests } from "./smoke.test";
import { Application } from "./helper/application";
import { Screenshots } from "./helper/screenshot";

export const app = new Application();
export const screenshots = new Screenshots();

// Skip executing smoke suite during regular extension unit test run
// when mocha globals are not yet defined. We detect presence of 'it'.
if (typeof (global as any).it === "function") {
    startSmokeTests(setUp, cleanUp);
}

async function setUp(): Promise<void> {
    const vscodeExecutablePath = await app.downloadVSCodeExecutable();
    await app.setVSCodeExecutablePath(vscodeExecutablePath);
    await app.cleanUserData();
    await app.installExtensionFromVSIX(vscodeExecutablePath);
    await screenshots.prepareScreenshotFolderForPlatform();
}

async function cleanUp(): Promise<void> {
    app.close();
}
