// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";

export class ReactNativeDebugConfigProvider implements vscode.DebugConfigurationProvider {

    public configurations = {
    "Debug Android": {
        "name": "Debug Android",
        "program": "${workspaceRoot}/.vscode/launchReactNative.js",
        "type": "reactnative",
        "request": "launch",
        "platform": "android",
        "sourceMaps": true,
        "outDir": "${workspaceRoot}/.vscode/.react",
    },
    "Debug iOS": {
        "name": "Debug iOS",
        "program": "${workspaceRoot}/.vscode/launchReactNative.js",
        "type": "reactnative",
        "request": "launch",
        "platform": "ios",
        "sourceMaps": true,
        "outDir": "${workspaceRoot}/.vscode/.react",
    },
    "Attach to packager": {
        "name": "Attach to packager",
        "program": "${workspaceRoot}/.vscode/launchReactNative.js",
        "type": "reactnative",
        "request": "attach",
        "sourceMaps": true,
        "outDir": "${workspaceRoot}/.vscode/.react",
    },
    "Debug in Exponent": {
        "name": "Debug in Exponent",
        "program": "${workspaceRoot}/.vscode/launchReactNative.js",
        "type": "reactnative",
        "request": "launch",
        "platform": "exponent",
        "sourceMaps": true,
        "outDir": "${workspaceRoot}/.vscode/.react",
    }};

    public async provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration[]> {
        const pickedConfigs = await vscode.window.showQuickPick(["Debug Android", "Debug iOS", "Attach to packager", "Debug in Exponent"], {canPickMany: true}, token);
        let launchConfig: vscode.DebugConfiguration[] = [];
        if (pickedConfigs) {

            pickedConfigs.forEach(element => {
                launchConfig.push(this.configurations[element]);
            });
        }

        return launchConfig;
    }
}