// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Page } from "playwright";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app, screenshots } from "./main";
import assert = require("assert");
import { ElementHelper } from "./helper/elementHelper";
import { Constant } from "./helper/constants";

export function startExtensionActivationTests(): void {
    describe("ExtensionActivationTest", () => {
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

        it("Verify extension is activated", async () => {
            let isActivited = false;
            await initApp();

            try {
                await ElementHelper.WaitElementSelectorVisible(
                    `[id="${Constant.previewExtensionId}"]`,
                    10000,
                );
                SmokeTestLogger.info("React-native preview extension is activated");
                isActivited = true;
            } catch {
                try {
                    await ElementHelper.WaitElementSelectorVisible(
                        `[id="${Constant.prodExtensionId}"]`,
                        10000,
                    );
                    SmokeTestLogger.info("React-native prod extension is activated");
                    isActivited = true;
                } catch {
                    isActivited = false;
                }
            }
            assert.ok(isActivited, "Extension is not activated. Skip other test cases...");
        });
    });
}
