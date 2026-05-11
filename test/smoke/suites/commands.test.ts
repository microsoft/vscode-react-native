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

        it("Verify react native command is visible in command palette", async () => {
            const text = "React Native: Start Packager";
            await BaseSmokeTest.initApp();

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
