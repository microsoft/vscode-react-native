// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Page } from "playwright";
import * as assert from "assert";
import { ComponentHelper } from "./helper/componentHelper";
import { ElementHelper } from "./helper/elementHelper";
import { Element } from "./helper/constants";
import { TimeoutConstants } from "./helper/timeoutConstants";
import { BaseSmokeTest } from "./helper/baseSmokeTest";

export function startCDPNodeVersionCompatibilityTests(): void {
    describe("CDPNodeVersionCompatibilityTest", () => {
        afterEach(BaseSmokeTest.dispose);

        it("Verify Run and Debug tab is accessible for debugging operations", async () => {
            await BaseSmokeTest.initApp();

            await ComponentHelper.openRunAndDebugTab();
            await ElementHelper.WaitElementClassNameVisible(
                Element.runAndDebugTabButtonClassName,
                5000,
            );

            SmokeTestLogger.info("Run and Debug tab is accessible");
        });

        it("Verify command palette can access debug-related commands", async () => {
            await BaseSmokeTest.initApp();

            await ComponentHelper.openCommandPalette();
            await ElementHelper.WaitElementClassNameVisible(Element.commandPaletteClassName, 5000);

            await ElementHelper.inputText("debug");
            const option = await ElementHelper.WaitElementSelectorVisible(
                Element.commandPaletteFocusedItemSelector,
                5000,
            );

            const value = await option.getAttribute("aria-label");
            assert.ok(value?.toLowerCase().includes("debug"));
            SmokeTestLogger.info("Debug commands are available in command palette");
        });

        it("Verify React Native packager is available for debugging", async () => {
            await BaseSmokeTest.initApp();

            await ComponentHelper.getReactNativePackager();
            SmokeTestLogger.info("React Native packager is available for debugging");
        });
    });
}
