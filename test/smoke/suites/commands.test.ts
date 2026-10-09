// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { ElementHelper } from "./helper/elementHelper";
import { Element } from "./helper/constants";
import { ComponentHelper } from "./helper/componentHelper";
import { TimeoutConstants } from "./helper/timeoutConstants";
import { BaseSmokeTest } from "./helper/baseSmokeTest";

async function commandVisible(commandVariants: string[]): Promise<boolean> {
    const rows = await ElementHelper.Page().$$(`#quickInput_list .monaco-list-row`);
    for (const row of rows) {
        const ariaLabel = (await row.getAttribute("aria-label")) || "";
        const textContent = (await row.textContent()) || "";
        const rowContent = `${ariaLabel} ${textContent}`.toLowerCase();

        if (commandVariants.some(variant => rowContent.includes(variant.toLowerCase()))) {
            return true;
        }
    }

    return false;
}

export function startCommandPaletteTests(): void {
    describe("CommandPaletteTest", () => {
        afterEach(BaseSmokeTest.dispose);

        it("Verify react native commands are visible in command palette", async () => {
            const expectedCommandGroups = [
                {
                    query: "Packager",
                    variants: [
                        "start packager",
                        "stop packager",
                        "restart packager",
                        "clean & restart packager",
                    ],
                },
                {
                    query: "Expo - Create EAS",
                    variants: ["expo - create eas config file", "create eas config file"],
                },
            ];

            await BaseSmokeTest.initApp();

            for (const commandGroup of expectedCommandGroups) {
                await ComponentHelper.openCommandPalette();
                await ElementHelper.WaitElementClassNameVisible(
                    Element.commandPaletteClassName,
                    TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
                );

                const selectAllKey = process.platform === "darwin" ? "Meta+A" : "Control+A";
                await ElementHelper.sendKeys(selectAllKey);
                await ElementHelper.sendKeys("Backspace");
                await ElementHelper.inputText(`>${commandGroup.query}`);
                await ElementHelper.WaitElementSelectorVisible(
                    "#quickInput_list .monaco-list-row",
                    TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
                );

                const found = await commandVisible(commandGroup.variants);
                assert.ok(
                    found,
                    `Command variants are not visible: ${commandGroup.variants.join(" | ")}`,
                );

                await ComponentHelper.closeCommandPalette();
            }
        });
    });
}
