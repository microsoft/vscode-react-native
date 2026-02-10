// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Page } from "playwright";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app, screenshots } from "./main";
import * as assert from "assert";
import { ElementHelper } from "./helper/elementHelper";
import { Element } from "./helper/constants";
import { ComponentHelper } from "./helper/componentHelper";
import { TimeoutConstants } from "./helper/timeoutConstants";
export function startCommandPaletteTests(): void {
    describe("CommandPaletteTest", () => {
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

        it("Verify react native command is visible in command palette", async () => {
            const text = "React Native: Start Packager";
            await initApp();

            await ComponentHelper.openCommandPalette();
            await ElementHelper.WaitElementClassNameVisible(
                Element.commandPaletteClassName,
                TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
            );

            await ElementHelper.inputText(text);
            const option = await ElementHelper.WaitElementSelectorVisible(
                Element.commandPaletteFocusedItemSelector,
                TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
            );

            const value = await option.getAttribute("aria-label");
            assert.ok(value?.includes(text));
        });
    });
}
