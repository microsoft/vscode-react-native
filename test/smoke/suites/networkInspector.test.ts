// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { BaseSmokeTest } from "./helper/baseSmokeTest";
import { ComponentHelper } from "./helper/componentHelper";
import { Element } from "./helper/constants";
import { ElementHelper } from "./helper/elementHelper";
import { TimeoutConstants } from "./helper/timeoutConstants";

export function startNetworkInspectorTests(): void {
    describe("NetworkInspectorTest", () => {
        afterEach(BaseSmokeTest.dispose);

        it("Verify network inspector commands are visible in command palette", async () => {
            await BaseSmokeTest.initApp();

            const expectedCommands = [
                "React Native: Run Network Inspector",
                "React Native: Stop Network Inspector",
            ];
            const selectAllKey = process.platform === "darwin" ? "Meta+A" : "Control+A";

            for (const command of expectedCommands) {
                await ComponentHelper.openCommandPalette();
                await ElementHelper.WaitElementClassNameVisible(
                    Element.commandPaletteClassName,
                    TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
                );

                await ElementHelper.sendKeys(selectAllKey);
                await ElementHelper.sendKeys("Backspace");
                await ElementHelper.inputText(`>${command}`);
                await ElementHelper.WaitElementSelectorVisible(
                    `#quickInput_list .monaco-list-row[aria-label*="${command}"]`,
                    TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
                );

                await ComponentHelper.closeCommandPalette();
            }
        });
    });
}
