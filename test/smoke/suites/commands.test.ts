// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app } from "./main";
import { expect } from "chai";

export function startDirectDebugTests(): void {
    describe("Command palette", () => {
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

        it("Command test", async () => {
            await initApp();
            const page = app.getPage();
            const cmdKey = process.platform === "darwin" ? "Meta" : "Control";

            await page.keyboard.press(`${cmdKey}+Shift+P`);
            await page.waitForSelector(".quick-input-widget", { timeout: 10000 });

            await page.keyboard.type("React");
            await page.keyboard.press("Enter");

            await page.waitForSelector(".editor-instance .view-lines", {
                timeout: 30000,
            });

            await page.keyboard.type("Hello VSCode UI Test!");
            await page.keyboard.press(`${cmdKey}+S`);

            const content = await page.$eval(
                ".editor-instance .view-lines",
                (el) => el.textContent?.replace(/\s+/g, "")
            );
            expect(content).to.contain("HelloVSCodeUITest!");
        });
    });
}
