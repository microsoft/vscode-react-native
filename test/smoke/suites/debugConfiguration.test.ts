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

        it("Complete debug configuration setup workflow", async () => {
            const launchFolderPath = path.join(
                __dirname,
                "..",
                "resources",
                "sampleReactNativeProject",
            );
            const vscodeFolderPath = path.join(launchFolderPath, ".vscode");
            if (!fs.existsSync(vscodeFolderPath)) {
                fs.mkdirSync(vscodeFolderPath);
            }

            fs.writeFileSync(path.join(vscodeFolderPath, "launch.json"), JSON.stringify({}));

            await initApp();

            await ComponentHelper.openFileExplorer();
            const vscodeFolder = await ComponentHelper.WaitFileVisibleInFileExplorer(".vscode");
            if (!vscodeFolder) {
                throw new Error(
                    "vscodeFolder is null. File '.vscode' was not found in the file explorer.",
                );
            }
            await vscodeFolder.click();
            await ElementHelper.clickElementByText("launch.json");

            const debugAddConfigurationButton = await ElementHelper.WaitElementSelectorVisible(
                Element.debugAddConfigurationButtonSelector,
                3000,
            );
            await debugAddConfigurationButton.click();

            const reactNativeButton = await ElementHelper.WaitElementSelectorVisible(
                Element.reactNativeButtonSelector,
                5000,
            );
            await reactNativeButton.click();

            const debugApplicationButton = await ElementHelper.WaitElementSelectorVisible(
                Element.debugApplicationButtonSelector,
                1000,
            );
            await debugApplicationButton.click();

            const androidButton = await ElementHelper.WaitElementSelectorVisible(
                Element.androidButtonSelector,
                1000,
            );
            await androidButton.click();

            const applicationInDirectModeButton = await ElementHelper.WaitElementSelectorVisible(
                Element.applicationInDirectModeButtonSelector,
                1000,
            );
            await applicationInDirectModeButton.click();
            await ElementHelper.waitPageLoad("domcontentloaded");
            const configurationElement = await ElementHelper.TryFindElement(
                Element.configurationElementSelector,
                5000,
            );

            let launchContent = await configurationElement?.textContent();
            if (launchContent) {
                launchContent = launchContent.replace(/\s/g, "");
                assert.ok(
                    launchContent.includes("DebugAndroidHermes"),
                    `Expected launchContent to include "Debug Android Hermes", but got: ${launchContent}`,
                );
            } else {
                assert.fail("Fail to set launch file configuration.");
            }
        });
    });
}
