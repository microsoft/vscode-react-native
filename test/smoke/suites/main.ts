// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { startSmokeTests } from "./smoke.test";
import { Application } from "./helper/application";
import { Screenshots } from "./helper/screenshot";

export const app = new Application();
export const screenshots = new Screenshots();

startSmokeTests(setUp, cleanUp);

async function setUp(): Promise<void> {
    const vscodeExecutablePath = await app.downloadVSCodeExecutable();
    await app.installExtensionFromVSIX(vscodeExecutablePath);
}

async function cleanUp(): Promise<void> {
    app.close();
}
