// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Page } from "playwright";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app, screenshots } from "./main";
import * as assert from "assert";
import { ComponentHelper } from "./helper/componentHelper";

export function startPackagerTests(): void {
    describe("PackagerTest", () => {
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

        it("Verify react-native packager state is changed correctly when start and stop metro", async () => {
            await initApp();

            let packager = await ComponentHelper.getReactNativePackager();
            let currentState = await packager.getAttribute("aria-label");
            assert.ok(currentState?.includes("play"));
            SmokeTestLogger.testLog("Packager is ready.");

            await packager.click();
            await ComponentHelper.waitPackagerStateIncludes("loading~spin");
            SmokeTestLogger.testLog("Packager is starting.");

            await ComponentHelper.waitPackagerStateIncludes("primitive-square");
            SmokeTestLogger.testLog("Packager is started.");

            await packager.click();
            await ComponentHelper.waitPackagerStateIncludes("play");
            SmokeTestLogger.testLog("Packager is stoped.");
        });

        it("Verify Clean & Restart Packager command works correctly", async function () {
            this.timeout(300000); // 5 minutes timeout for clean restart
            await initApp();

            // Ensure packager is running first
            let packager = await ComponentHelper.getReactNativePackager();
            let currentState = await packager.getAttribute("aria-label");

            if (currentState?.includes("play")) {
                // Start the packager if it's not running
                await packager.click();
                await ComponentHelper.waitPackagerStateIncludes("primitive-square");
                SmokeTestLogger.testLog("Packager started before clean restart test.");
            }

            // Execute Clean & Restart Packager command
            SmokeTestLogger.testLog("Executing Clean & Restart Packager command...");
            await ComponentHelper.executeCommand("React Native: Clean & Restart Packager (Metro)");

            // Wait for the packager to restart (it should show loading state first)
            await ComponentHelper.waitPackagerStateIncludesOneOf(
                ["loading~spin", "primitive-square"],
                60000,
            );
            SmokeTestLogger.testLog("Packager is restarting after clean...");

            // Wait for packager to finish restarting and be fully running
            await ComponentHelper.waitPackagerStateIncludes("primitive-square", 120000);
            SmokeTestLogger.testLog("Packager successfully restarted with clean cache.");
        });
    });
}
