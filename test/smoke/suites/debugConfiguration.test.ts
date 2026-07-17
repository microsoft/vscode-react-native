// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import assert = require("assert");
import { ElementHelper } from "./helper/elementHelper";
import { Element } from "./helper/constants";
import { ComponentHelper } from "./helper/componentHelper";
import { TimeoutConstants } from "./helper/timeoutConstants";
import { BaseSmokeTest } from "./helper/baseSmokeTest";

export function startDebugConfigurationTests(): void {
    describe("DebugConfigurationTest", () => {
        afterEach(BaseSmokeTest.dispose);

        it("Verify extension debugger is visible in select debugger list", async () => {
            const createLaunchFile = "create a launch.json file";
            const rnOptionText = "More React Native options...";

            await BaseSmokeTest.initApp();

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

            await BaseSmokeTest.initApp();

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
                TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
            );
            await reactNativeButton.click();

            const debugApplicationButton = await ElementHelper.WaitElementSelectorVisible(
                Element.debugApplicationButtonSelector,
                2000,
            );
            await debugApplicationButton.click();

            const androidButton = await ElementHelper.WaitElementSelectorVisible(
                Element.androidButtonSelector,
                3000,
            );
            await androidButton.click();

            const applicationInDirectModeButton = await ElementHelper.WaitElementSelectorVisible(
                Element.applicationInDirectModeButtonSelector,
                1000,
            );
            await applicationInDirectModeButton.click();
            await ElementHelper.waitPageLoad("domcontentloaded");

            const launchContent = await ComponentHelper.waitUntil<string>(
                async () => {
                    const configurationElement = await ElementHelper.TryFindElement(
                        Element.configurationElementSelector,
                        TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
                    );
                    const text = (await configurationElement?.textContent()) || "";
                    const normalized = text.replace(/\s/g, "");

                    return {
                        ok: normalized.includes("DebugAndroidHermes"),
                        actual: normalized || "<empty>",
                        value: text,
                    };
                },
                {
                    operation: "launch.json debug configuration update",
                    expected: 'content includes "DebugAndroidHermes"',
                    timeout: TimeoutConstants.DEBUG_CONFIGURATION_TIMEOUT,
                    interval: 500,
                },
            );

            assert.ok(
                !!launchContent,
                "Expected launch.json content to be available after configuration insertion.",
            );
        });
    });
}
