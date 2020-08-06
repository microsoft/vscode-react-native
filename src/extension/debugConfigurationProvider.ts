// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { TelemetryHelper } from "../common/telemetryHelper";
import { Telemetry } from "../common/telemetry";
import * as nls from "vscode-nls";
import { PlatformType } from "./launchArgs";
import { IWDPHelper } from "../debugger/direct/IWDPHelper";
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize = nls.loadMessageBundle();

export const DEBUG_TYPES = {
    REACT_NATIVE: "reactnative-preview",
    REACT_NATIVE_DIRECT: "reactnativedirect-preview",
};

export class ReactNativeDebugConfigProvider implements vscode.DebugConfigurationProvider {
    private debugConfigurations = {
        "Debug Android (Preview)": {
            "name": "Debug Android (Preview)",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE,
            "request": "launch",
            "platform": PlatformType.Android,
        },
        "Run Android (Preview)": {
            "name": "Run Android (Preview)",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE,
            "request": "launch",
            "platform": PlatformType.Android,
            "enableDebug": false,
        },
        "Debug iOS (Preview)": {
            "name": "Debug iOS (Preview)",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE,
            "request": "launch",
            "platform": PlatformType.iOS,
        },
        "Run iOS (Preview)": {
            "name": "Run iOS (Preview)",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE,
            "request": "launch",
            "platform": PlatformType.iOS,
            "enableDebug": false,
        },
        "Debug Windows (Preview)": {
            "name": "Debug Windows (Preview)",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE,
            "request": "launch",
            "platform": PlatformType.Windows,
        },
        "Attach to packager (Preview)": {
            "name": "Attach to packager (Preview)",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE,
            "request": "attach",
        },
        "Debug in Exponent (Preview)": {
            "name": "Debug in Exponent (Preview)",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE,
            "request": "launch",
            "platform": PlatformType.Exponent,
        },
        "Debug Android Hermes (Preview) - Experimental": {
            "name": "Debug Android Hermes (Preview) - Experimental",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE_DIRECT,
            "request": "launch",
            "platform": PlatformType.Android,
        },
        "Run Android Hermes (Preview) - Experimental": {
            "name": "Run Android Hermes (Preview) - Experimental",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE_DIRECT,
            "request": "launch",
            "platform": PlatformType.Android,
            "enableDebug": false,
        },
        "Attach to the React Native Hermes - Experimental": {
            "name": "Attach to the React Native Hermes - Experimental",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE_DIRECT,
            "request": "attach",
        },
        "Attach to the React Native iOS - Experimental": {
            "name": "Attach to the React Native iOS - Experimental",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE_DIRECT,
            "request": "attach",
            "platform": PlatformType.iOS,
            "port": IWDPHelper.iOS_WEBKIT_DEBUG_PROXY_DEFAULT_PORT // 9221
        },
        "Debug Direct iOS (Preview) - Experimental": {
            "name": "Direct Debug iOS (Preview) - Experimental",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE_DIRECT,
            "request": "launch",
            "platform": PlatformType.iOS,
            "port": IWDPHelper.iOS_WEBKIT_DEBUG_PROXY_DEFAULT_PORT // 9221
        },
        "Run Direct iOS (Preview) - Experimental": {
            "name": "Run Direct iOS (Preview) - Experimental",
            "cwd": "${workspaceFolder}",
            "type": DEBUG_TYPES.REACT_NATIVE_DIRECT,
            "request": "launch",
            "platform": PlatformType.iOS,
            "enableDebug": false,
        }
    };

    private pickConfig: ReadonlyArray<vscode.QuickPickItem> = [
        {
            label: "Debug Android (Preview)",
            description: localize("DebugAndroidConfigDesc", "Run and debug Android application"),
        },
        {
            label: "Run Android (Preview)",
            description: localize("RunAndroidConfigDesc", "Run Android application"),
        },
        {
            label: "Debug iOS (Preview)",
            description: localize("DebugiOSConfigDesc", "Run and debug iOS application"),
        },
        {
            label: "Run iOS (Preview)",
            description: localize("RuniOSConfigDesc", "Run iOS application"),
        },
        {
            label: "Debug Windows (Preview)",
            description: localize("DebugWindowsConfigDesc", "Run and debug Windows application"),
        },
        {
            label: "Attach to packager (Preview)",
            description: localize("AttachToPackagerConfigDesc", "Attach to already working application packager"),
        },
        {
            label: "Debug in Exponent (Preview)",
            description: localize("DebugExpoConfigDesc", "Debug Expo application or React Native application in Expo"),
        },
        {
            label: "Debug Android Hermes (Preview) - Experimental",
            description: localize("DebugAndroidHermesConfigDesc", "Run and debug Android Hermes application"),
        },
        {
            label: "Attach to the React Native Hermes - Experimental",
            description: localize("AttachToPackagerHermesConfigDesc", "Attach to already working React Native Hermes application on Android directly"),
        },
        {
            label: "Attach to the React Native iOS - Experimental",
            description: localize("AttachToPackageriOSConfigDesc", "Attach to already working React Native iOS application directly"),
        },
        {
            label: "Debug Direct iOS (Preview) - Experimental",
            description: localize("DebugDirectiOSConfigDesc", "Run and debug iOS application directly"),
        },
        {
            label: "Run Direct iOS (Preview) - Experimental",
            description: localize("RunDirectiOSConfigDesc", "Run iOS application with direct debugging support"),
        },
    ];

    public async provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration[]> {
        return new Promise<vscode.DebugConfiguration[]>((resolve) => {
            const configPicker = this.prepareDebugConfigPicker();
            const disposables: vscode.Disposable[] = [];
            const pickHandler = () => {
                let chosenConfigsEvent = TelemetryHelper.createTelemetryEvent("chosenDebugConfigurations");
                let selected: string[] = configPicker.selectedItems.map(element => element.label);
                chosenConfigsEvent.properties["selectedItems"] = selected;
                Telemetry.send(chosenConfigsEvent);
                const launchConfig = this.gatherDebugScenarios(selected);
                disposables.forEach(d => d.dispose());
                resolve(launchConfig);
            };

            disposables.push(
                configPicker.onDidAccept(pickHandler),
                configPicker.onDidHide(pickHandler),
                configPicker
            );

            configPicker.show();
        });
    }

    private gatherDebugScenarios(selectedItems: string[]): vscode.DebugConfiguration[] {
        let launchConfig: vscode.DebugConfiguration[] = selectedItems.map(element => this.debugConfigurations[element]);
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
