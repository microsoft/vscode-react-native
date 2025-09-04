// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app } from "./main";
import * as assert from "assert";

export function startCommandPaletteTests(): void {
    describe("Command palette test", () => {
        async function initApp(): Promise<void> {
            await app.launch();
        }

        async function disposeAll() {
            try {
                SmokeTestLogger.info("Dispose all ...");
                if (app) {
                    SmokeTestLogger.info("Stopping application ...");
                    await app.close();
                }
            } catch (error) {
                SmokeTestLogger.error("Error while disposeAll:");
                SmokeTestLogger.error(error);
            }
        }

        afterEach(disposeAll);

        it("Verify react native command is visible in command palette", async () => {
            await initApp();
            const page = app.getMainPage();
            const cmdKey = process.platform === "darwin" ? "Meta" : "Control";

            await page.keyboard.press(`${cmdKey}+Shift+P`);
            await page.waitForSelector(".quick-input-widget", { timeout: 10000 });

            await page.keyboard.type("React Native: Start Packager");

            const option = await page.waitForSelector("#quickInput_list .monaco-list-row.focused", {
                timeout: 30000,
            });
            const value = await option.getAttribute("aria-label");

            assert.ok(value?.includes("React Native: Start Packager"));
        });
    });
}
