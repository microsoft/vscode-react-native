// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { ElementHelper } from "./helper/elementHelper";
import { Element } from "./helper/constants";
import { ComponentHelper } from "./helper/componentHelper";
import { TimeoutConstants } from "./helper/timeoutConstants";
import { BaseSmokeTest } from "./helper/baseSmokeTest";
export function startCommandPaletteTests(): void {
    describe("CommandPaletteTest", () => {
        afterEach(BaseSmokeTest.dispose);

        it("Verify react native commands are visible in command palette", async () => {
            const expectedCommands = [
                "React Native: Start Packager",
                "React Native: Clean & Restart Packager (Metro)",
                "React Native: Install CocoaPods dependencies",
                "React Native: Run EAS Build",
                "React Native: Expo - Run Doctor",
                "React Native: Expo - Prebuild",
                "React Native: Expo - Prebuild Clean",
            ];

            await BaseSmokeTest.initApp();

            for (const command of expectedCommands) {
                await ComponentHelper.openCommandPalette();
                await ElementHelper.WaitElementClassNameVisible(
                    Element.commandPaletteClassName,
                    TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
                );

                await ElementHelper.inputText(command);
                const option = await ElementHelper.WaitElementSelectorVisible(
                    Element.commandPaletteFocusedItemSelector,
                    TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
                );

                const value = await option.getAttribute("aria-label");
                assert.ok(value?.includes(command), `Command '${command}' is not visible`);

                await ComponentHelper.closeCommandPalette();
            }
        });
    });
}
