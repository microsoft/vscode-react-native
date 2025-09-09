// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Page } from "playwright";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app, screenshots } from "./main";
import assert = require("assert");

export function startExtensionActivationTests(): void {
    describe("ExtensionActivationTest", () => {
        async function initApp(): Promise<Page> {
            await app.launch();
            return app.getMainPage();
        }

        async function dispose() {
            try {
                if (this.currentTest?.state === "failed") {
                    SmokeTestLogger.info("Test failed, taking screenshot ...");
                    await screenshots.takeScreenshots(
                        this.currentTest.parent?.title || "Others",
                        this.currentTest.title.replace(/\s+/g, "_"),
                    );
                }
            } catch (error) {
                // Log error when screenshot get error, but not throw exception
                SmokeTestLogger.log(`Error with taking screenshot: ${error}`);
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

        it("Verify extension is activated", async () => {
            const page = await initApp();
            const isActivited = await app.getExtension().checkExtensionActivated(page);
            assert.ok(isActivited, "Extension is not activated. Skip other test cases...");
        });
    });
}
