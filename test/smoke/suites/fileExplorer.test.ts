// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Page } from "playwright";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app, screenshots } from "./main";
import { CommonHelper } from "./helper/commonHelper";
import { ComponentHelper } from "./helper/componentHelper";
import * as assert from "assert";

export function startFileExplorerTests(): void {
    describe("FileExplorerTest", () => {
        async function initApp(): Promise<Page> {
            await app.launch();
            return app.getMainPage();
        }

        async function dispose() {
            if (this.currentTest?.state === "failed") {
                SmokeTestLogger.info("Test failed, taking screenshot ...");
                await screenshots.takeScreenshots(
                    this.currentTest.parent?.title || "Others",
                    this.currentTest.title.replace(/\s+/g, "_"),
                );
            }
            try {
                SmokeTestLogger.info(`Dispose test: "${this.currentTest.title}" ...`);
                if (app) {
                    await app.close();
                }
            } catch (error) {
                SmokeTestLogger.error(`Error while dispose: ${error}`);
            }
        }

        afterEach(dispose);

        it("Verify .vscode folder will be created when extension is activated", async () => {
            const projectName = "sampleReactNativeProject";
            const folderName = ".vscode";
            await CommonHelper.findAndDeleteVSCodeSettingsDirectory(projectName);

            await initApp();

            await ComponentHelper.openFileExplorer();
            const folder = await ComponentHelper.WaitFileVisibleInFileExplorer(folderName);

            assert.notStrictEqual(folder, null);
        });
    });
}
