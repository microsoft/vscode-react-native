// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import { SettingsHelper } from "../../src/extension/settingsHelper";

suite("settingsHelper", function () {
    suite("extensionContext", function () {
        const projectPath = path.resolve(__dirname, "..", "resources", "sampleReactNativeProject");
        const settingsPath = path.resolve(projectPath, ".vscode", "settings.json");
        const emptyTelemetrySettingsPath = path.resolve(
            projectPath,
            ".vscode",
            "emptyTelemetrySettings.json",
        );

        suite("PackagerSettings", function () {
            test("Should get the packager port configured from workspace settings file", async function () {
                const port = await SettingsHelper.getPackagerPort(projectPath);
                assert.strictEqual(port, 8088);
            });
        });

        suite("TemeletrySettings", function () {
            test("Should get the telemetry config from workspace settings file", async function () {
                const telemetry = await SettingsHelper.getWorkspaceTelemetry(settingsPath);
                assert.strictEqual(telemetry, false);
            });

            test("Should get correct telemetry config when user changes settings", async function () {
                const telemetry = await SettingsHelper.getWorkspaceTelemetry(
                    emptyTelemetrySettingsPath,
                );
                assert.strictEqual(telemetry, "");
            });
        });
    });
});
