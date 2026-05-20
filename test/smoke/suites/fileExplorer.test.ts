// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CommonHelper } from "./helper/commonHelper";
import { ComponentHelper } from "./helper/componentHelper";
import assert = require("assert");
import { BaseSmokeTest } from "./helper/baseSmokeTest";

export function startFileExplorerTests(): void {
    describe("FileExplorerTest", () => {
        afterEach(BaseSmokeTest.dispose);

        it("Verify .vscode folder will be created when extension is activated", async () => {
            const projectName = "sampleReactNativeProject";
            const folderName = ".vscode";
            await CommonHelper.findAndDeleteVSCodeSettingsDirectory(projectName);

            await BaseSmokeTest.initApp();

            await ComponentHelper.openFileExplorer();
            const folder = await ComponentHelper.WaitFileVisibleInFileExplorer(folderName);

            assert.notStrictEqual(folder, null);
        });
    });
}
