// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import { SettingsHelper } from "../../src/extension/settingsHelper";

suite("workspace", function () {
    suite("extensionContext", function () {
        test("Should get react-native.workspace.exclude correctly from workspace settings file", async function () {
            const noWorkspacePath = undefined;
            const exclude1 = await SettingsHelper.getWorkspaceFileExcludeFolder(noWorkspacePath);
            assert.strictEqual(exclude1.length, 0);

            const noExcludeWorkspacePath = path.resolve(
                __dirname,
                "..",
                "resources",
                "workspaceSettingsSample",
                "noExcludeSetting.code-workspace",
            );
            const exclude2 = await SettingsHelper.getWorkspaceFileExcludeFolder(
                noExcludeWorkspacePath,
            );
            assert.strictEqual(exclude2.length, 0);

            const excludeWorkspacePath = path.resolve(
                __dirname,
                "..",
                "resources",
                "workspaceSettingsSample",
                "excludeSetting.code-workspace",
            );
            const exclude3 = await SettingsHelper.getWorkspaceFileExcludeFolder(
                excludeWorkspacePath,
            );
            assert.strictEqual(exclude3.length, 1);
            assert.strictEqual(exclude3[0], "testProject2");
        });

        test("Should read content with comment line correctly from workspace settings file", async function () {
            const commentSettingPath = path.resolve(
                __dirname,
                "..",
                "resources",
                "workspaceSettingsSample",
                "settingWithComment.code-workspace",
            );
            const exclude = await SettingsHelper.getWorkspaceFileExcludeFolder(commentSettingPath);
            assert.strictEqual(exclude.length, 1);
            assert.strictEqual(exclude[0], "testProject2");
        });
    });
});
