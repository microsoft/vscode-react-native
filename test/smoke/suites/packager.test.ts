// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Page } from "playwright";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app, screenshots } from "./main";
import * as assert from "assert";
import { ComponentHelper } from "./helper/componentHelper";
import { WaitHelper } from "./helper/waitHelper";

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
            await WaitHelper.waitIsTrue(async () => {
                packager = await ComponentHelper.getReactNativePackager();
                currentState = await packager.getAttribute("aria-label");
                try {
                    assert.ok(currentState?.includes("loading~spin"));
                    return true;
                } catch {
                    return false;
                }
            });
            SmokeTestLogger.testLog("Packager is starting.");

            await WaitHelper.waitIsTrue(async () => {
                packager = await ComponentHelper.getReactNativePackager();
                currentState = await packager.getAttribute("aria-label");
                try {
                    assert.ok(currentState?.includes("primitive-square"));
                    return true;
                } catch {
                    return false;
                }
            });
            SmokeTestLogger.testLog("Packager is started.");

            await packager.click();
            await WaitHelper.waitIsTrue(async () => {
                packager = await ComponentHelper.getReactNativePackager();
                currentState = await packager.getAttribute("aria-label");
                try {
                    assert.ok(currentState?.includes("play"));
                    return true;
                } catch {
                    return false;
                }
            });
            SmokeTestLogger.testLog("Packager is stoped.");
        });
    });
}
