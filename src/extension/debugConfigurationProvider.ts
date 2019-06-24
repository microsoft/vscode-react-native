// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { TelemetryHelper } from "../common/telemetryHelper";
import { Telemetry } from "../common/telemetry";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();

export class ReactNativeDebugConfigProvider implements vscode.DebugConfigurationProvider {
    private debugConfigurations = {
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
        }
    };

    private pickConfig: ReadonlyArray<vscode.QuickPickItem> = [
        {
            label: "Debug Android",
            description: localize("DebugAndroidConfigDesc", "Run and debug Android application"),
        },
        {
            label: "Debug iOS",
            description: localize("DebugiOSConfigDesc", "Run and debug iOS application"),
        },
        {
            label: "Attach to packager",
            description: localize("AttachToPackagerConfigDesc", "Attach to already working application packager"),
        },
        {
            label: "Debug in Exponent",
            description: localize("DebugExpoConfigDesc", "Debug Expo application or React Native application in Expo"),
        },
    ];

    public async provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration[]> {
        return new Promise<vscode.DebugConfiguration[]>((resolve) => {
            const configPicker = this.prepareDebugConfigPicker();
            configPicker.show();
            const disposables: vscode.Disposable[] = [];

            const pickHandler = () => {
                let chosenConfigsEvent = TelemetryHelper.createTelemetryEvent("ChosenDebugConfigurations");
                let selected: string[] = [];
                configPicker.selectedItems.forEach((element) => {
                    selected.push(element.label);
                });
                chosenConfigsEvent.properties["SelectedItems"] = selected;
                Telemetry.send(chosenConfigsEvent);
                const launchConfig = this.gatherDebugScenarios(selected);
                disposables.forEach(d => d.dispose());
                configPicker.dispose();
                resolve(launchConfig);
            };

            disposables.push(
                configPicker.onDidAccept(pickHandler),
                configPicker.onDidHide(pickHandler)
            );

        });
    }

    private gatherDebugScenarios(selectedItems: string[]): vscode.DebugConfiguration[] {
        let launchConfig: vscode.DebugConfiguration[] = [];
        if (selectedItems) {
            selectedItems.forEach(element => {
                launchConfig.push(this.debugConfigurations[element]);
            });
        }
        return launchConfig;
    }

    private prepareDebugConfigPicker(): vscode.QuickPick<vscode.QuickPickItem> {
        const debugConfigPicker = vscode.window.createQuickPick();
        debugConfigPicker.canSelectMany = true;
        debugConfigPicker.ignoreFocusOut = true;
        debugConfigPicker.title = localize("DebugConfigQuickPickLabel", "Pick debug configurations");
        debugConfigPicker.items = this.pickConfig;
        // QuickPickItem property `picked` doesn't work, so this line will check first item in the list
        // which is supposed to be Debug Android
        debugConfigPicker.selectedItems = [this.pickConfig[0]];
        return debugConfigPicker;
    }
}
