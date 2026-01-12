// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Page } from "playwright";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app, screenshots } from "./main";
import { ElementHelper } from "./helper/elementHelper";
import { Element } from "./helper/constants";
import { WaitHelper } from "./helper/waitHelper";
import { ComponentHelper } from "./helper/componentHelper";
import * as assert from "assert";

export function startActionBarTests(): void {
    describe("ActionBarTest", () => {
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
                SmokeTestLogger.info(`Dispose test: "${this.currentTest?.title ?? "unknown"}" ...`);
                if (app) {
                    await app.close();
                }
            } catch (error) {
                SmokeTestLogger.error(
                    `Error while dispose: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
        }

        afterEach(dispose);

        it("Verify extension quick debug action button is working correctly", async () => {
            await initApp();

            const debugActionItemDropdown = await ElementHelper.TryFindElement(
                `[aria-label="${Element.debugActionItemDropdownAriaLable}"]`,
            );
            assert.notStrictEqual(
                debugActionItemDropdown,
                null,
                "Debug action item dropdown should be present in the UI",
            );

            const actionButton = await ElementHelper.WaitElementSelectorVisible(
                Element.debugActionItemButtonSelector,
            );
            await actionButton.click();

            await WaitHelper.waitIsTrue(async () => {
                const packager = await ComponentHelper.getReactNativePackager();
                const currentState = await packager.getAttribute("aria-label");
                try {
                    assert.ok(
                        currentState?.includes("primitive-square"),
                        `Expected packager state to include 'primitive-square', got: ${currentState}`,
                    );
                    return true;
                } catch {
                    return false;
                }
            });
        });
    });
}
