// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Page } from "playwright";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app, screenshots } from "./main";
import * as assert from "assert";
import { ElementHelper } from "./helper/elementHelper";
import { Element } from "./helper/constants";

export function startCommandPaletteTests(): void {
    describe("CommandPaletteTest", () => {
        async function initApp(): Promise<Page> {
            await app.launch();
            return app.getMainPage();
        }

        async function dispose() {
            try {
                if (this.currentTest?.state === "failed") {
                    SmokeTestLogger.info("Test failed, taking screenshot ...");
                    await screenshots.takeScreenshots(
                        this.currentTest.parent?.title || "Others",
                        this.currentTest.title.replace(/\s+/g, "_"),
                    );
                }
            } catch (error) {
                // Log error when screenshot get error, but not throw exception
                SmokeTestLogger.log(`Error with taking screenshot: ${error}`);
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

        it("Verify react native command is visible in command palette", async () => {
            const text = "React Native: Start Packager";
            await initApp();

            await ElementHelper.openCommandPalette();
            await ElementHelper.WaitElementClassNameVisible(Element.commandPaletteClassName, 5000);

            await ElementHelper.inputText(text);
            const option = await ElementHelper.WaitElementSelectorVisible(
                Element.commandPaletteFocusedItemSelector,
                5000,
            );

            const value = await option.getAttribute("aria-label");
            assert.ok(value?.includes(text));
        });
    });
}
