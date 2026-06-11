// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Page } from "playwright";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app, screenshots } from "./main";
import { ElementHelper } from "./helper/elementHelper";
import { Element } from "./helper/constants";
import { ComponentHelper } from "./helper/componentHelper";
import { TimeoutConstants } from "./helper/timeoutConstants";
import assert = require("assert");

export function startActionBarTests(): void {
    describe("ActionBarTest", () => {
        async function initApp(): Promise<Page> {
            await app.launch();
            return app.getMainPage();
        }

        async function dispose(this: Mocha.Context): Promise<void> {
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

            const packagerStartingOrStarted = await ComponentHelper.isPackagerStateIncludesOneOf(
                ["loading~spin", "primitive-square"],
                15000,
            );

            if (!packagerStartingOrStarted) {
                SmokeTestLogger.testLog(
                    "Quick debug action did not trigger packager on first click, retrying with mouse click.",
                );
                await ElementHelper.mouseClick(actionButton);
                await ComponentHelper.waitPackagerStateIncludesOneOf(
                    ["loading~spin", "primitive-square"],
                    TimeoutConstants.PACKAGER_STATE_TIMEOUT,
                );
            }

            await ComponentHelper.waitPackagerStateIncludes(
                "primitive-square",
                TimeoutConstants.PACKAGER_STATE_TIMEOUT,
            );
        });
    });
}
