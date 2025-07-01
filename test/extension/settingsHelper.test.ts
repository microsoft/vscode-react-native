// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import * as mockFs from "mock-fs";
import * as fs from "fs";
import { SettingsHelper } from "../../src/extension/settingsHelper";

suite("settingsHelper", function () {
    suite("extensionContext", function () {
        const projectPath = path.resolve(__dirname, "..", "resources", "sampleReactNativeProject");

        const settingsPath = path.resolve(projectPath, ".vscode", "settings.json");

        test("Should get the packager port configured from workspace settings file", async function () {
            const port = await SettingsHelper.getPackagerPort(projectPath);
            assert.strictEqual(port, 8088);
        });

        test("Should get the telemetry configured from workspace settings file", async function () {
            const telemetry = await SettingsHelper.getWorkspaceTelemetry(settingsPath);
            assert.strictEqual(telemetry, false);
        });

        test("should return empty string when telemetry setting is not present", async function () {
            mockFs({
                [settingsPath]: JSON.stringify({
                    "react-native.packager.port": 8088,
                    "react-native-tools.telemetry.optIn": false,
                }),
            });
            const raw = fs.readFileSync(settingsPath, "utf-8");
            const settings = JSON.parse(raw);

            delete settings["react-native-tools.telemetry.optIn"];

            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
            const telemetry = await SettingsHelper.getWorkspaceTelemetry(settingsPath);
            assert.strictEqual(telemetry, "");
            mockFs.restore();
        });
    });
});
