// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as vscode from "vscode";

suite("commandsExecution", function () {
    suite("networkViewCommand", function () {
        test("should update newwork view via api successfully", async () => {
            const config = vscode.workspace.getConfiguration("debug.javascript");
            const currentValue = config.get("enableNetworkView");

            if (currentValue == false) {
                await config.update("enableNetworkView", true, vscode.ConfigurationTarget.Global);
                const changedValue = vscode.workspace
                    .getConfiguration("debug.javascript")
                    .get("enableNetworkView");
                assert.deepStrictEqual(changedValue, true);
            } else {
                await config.update("enableNetworkView", false, vscode.ConfigurationTarget.Global);
                const changedValue = vscode.workspace
                    .getConfiguration("debug.javascript")
                    .get("enableNetworkView");
                assert.deepStrictEqual(changedValue, false);
            }
        });
    });
});
