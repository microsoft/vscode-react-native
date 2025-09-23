// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import { Page } from "playwright";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { app, screenshots } from "./main";
import * as assert from "assert";
import { ElementHelper } from "./helper/elementHelper";
import { Element } from "./helper/constants";
import { ComponentHelper } from "./helper/componentHelper";

export function startDebugConfigurationTests(): void {
    describe("DebugConfigurationTest", () => {
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

        it("Verify extension debugger is visible in select debugger list", async () => {
            const createLaunchFile = "create a launch.json file";
            const rnOptionText = "More React Native options...";

            await initApp();

            await ComponentHelper.openRunAndDebugTab();
            await ElementHelper.WaitElementClassNameVisible(Element.welcomeViewClassName);
            await ElementHelper.clickElementByText(createLaunchFile);

            const rnOption = await ElementHelper.TryFindElement(
                `[aria-label="${rnOptionText}"]`,
                2000,
            );
            assert.notStrictEqual(rnOption, null);
        });

        it.only("Complete debug configuration setup workflow", async () => {
            const createLaunchFile = "create a launch.json file";
            const rnOptionText = "More React Native options...";
            const projectRoot = path.join(__dirname, "..", "resources", "sampleReactNativeProject");

            fs.writeFileSync(path.join(projectRoot, ".vscode", "launch.json"), JSON.stringify({}));

            await initApp();

            await ComponentHelper.openFileExplorer();
            const vscodeFolder = await ComponentHelper.WaitFileVisibleInFileExplorer(".vscode");
            assert.notStrictEqual(vscodeFolder, null, ".vscode folder should exist");

            await ElementHelper.clickElementByText("launch.json");
            await ElementHelper.clickElementByText(createLaunchFile);

            const debugAddConfigurationButton = await ElementHelper.TryFindElement(
                `[aria-label="${Element.debugAddConfigurationButtonAriaLabel}"]`,
            );
            assert.notStrictEqual(debugAddConfigurationButton, null);
            if (debugAddConfigurationButton) {
                await debugAddConfigurationButton.click();
            }

            const rnOption = await ElementHelper.TryFindElement(
                `[aria-label="${rnOptionText}"]`,
                3000,
            );
            assert.notStrictEqual(rnOption, null, "React Native debug option should be available");

            if (rnOption) {
                await rnOption.click();
                SmokeTestLogger.info(
                    "Successfully initiated React Native debug configuration setup",
                );
            }
        });
    });
}
