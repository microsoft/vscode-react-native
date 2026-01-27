// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Page } from "playwright";
import { SmokeTestLogger } from "./smokeTestLogger";
import { app, screenshots } from "../main";

/**
 * Base class for smoke tests that provides common setup and teardown functionality
 */
export class BaseSmokeTest {
    /**
     * Initialize the application and return the main page
     */
    public static async initApp(): Promise<Page> {
        await app.launch();
        return app.getMainPage();
    }

    /**
     * Common dispose function to be called after each test
     * Takes screenshots on failure and closes the app
     */
    public static async dispose(this: any): Promise<void> {
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
}
