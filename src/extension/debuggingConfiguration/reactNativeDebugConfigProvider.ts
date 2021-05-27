// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { Telemetry } from "../../common/telemetry";
import { PlatformType } from "../launchArgs";
import { IWDPHelper } from "../../debugger/direct/IWDPHelper";
import { DebugScenarioNameGenerator } from "./debugScenarioNameGenerator";
import { ILaunchRequestArgs } from "../../debugger/debugSessionBase";
import {
    DEBUG_TYPES,
    DebugScenarioType,
    DebugConfigurationQuickPickItem,
    DebugConfigurationState,
} from "./debugConfigTypesAndConstants";
import { MultiStepInput, IMultiStepInput, InputStep, IQuickPickParameters } from "./multiStepInput";
import { ConfigProviderFactory } from "./configurationProviders/configProviderFactory";
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class ReactNativeDebugConfigProvider implements vscode.DebugConfigurationProvider {
    private debugConfigurations = {
        "Attach to Hermes application - Experimental": {
            name: "Attach to Hermes application - Experimental",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
            request: "attach",
        },
        "Attach to Direct iOS - Experimental": {
            name: "Attach to Direct iOS - Experimental",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
            request: "attach",
            platform: PlatformType.iOS,
            useHermesEngine: false,
            port: IWDPHelper.iOS_WEBKIT_DEBUG_PROXY_DEFAULT_PORT, // 9221
        },
        "Attach to packager": {
            name: "Attach to packager",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE,
            request: "attach",
        },
        "Debug Android": {
            name: "Debug Android",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE,
            request: "launch",
            platform: PlatformType.Android,
        },
        "Debug iOS": {
            name: "Debug iOS",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE,
            request: "launch",
            platform: PlatformType.iOS,
        },
        "Debug Windows": {
            name: "Debug Windows",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE,
            request: "launch",
            platform: PlatformType.Windows,
        },
        "Debug macOS": {
            name: "Debug macOS",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE,
            request: "launch",
            platform: PlatformType.macOS,
        },
        "Debug in Exponent": {
            name: "Debug in Exponent",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE,
            request: "launch",
            platform: PlatformType.Exponent,
        },
        "Debug Android Hermes - Experimental": {
            name: "Debug Android Hermes - Experimental",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
            request: "launch",
            platform: PlatformType.Android,
        },
        "Debug Direct iOS - Experimental": {
            name: "Debug Direct iOS - Experimental",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
            request: "launch",
            platform: PlatformType.iOS,
            useHermesEngine: false,
            target: "device",
            port: IWDPHelper.iOS_WEBKIT_DEBUG_PROXY_DEFAULT_PORT, // 9221
        },
        "Debug iOS Hermes - Experimental": {
            name: "Debug iOS Hermes - Experimental",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
            request: "launch",
            platform: PlatformType.iOS,
        },
        "Debug macOS Hermes - Experimental": {
            name: "Debug macOS Hermes - Experimental",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
            request: "launch",
            platform: PlatformType.macOS,
        },
        "Run Android": {
            name: "Run Android",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE,
            request: "launch",
            platform: PlatformType.Android,
            enableDebug: false,
        },
        "Run iOS": {
            name: "Run iOS",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE,
            request: "launch",
            platform: PlatformType.iOS,
            enableDebug: false,
        },
        "Run Windows": {
            name: "Run Windows",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE,
            request: "launch",
            platform: PlatformType.Windows,
            enableDebug: false,
        },
        "Run Macos": {
            name: "Run Macos",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE,
            request: "launch",
            platform: PlatformType.macOS,
            enableDebug: false,
        },
        "Run Android Hermes - Experimental": {
            name: "Run Android Hermes - Experimental",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
            request: "launch",
            platform: PlatformType.Android,
            enableDebug: false,
        },
        "Run iOS Hermes - Experimental": {
            name: "Run iOS Hermes - Experimental",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
            request: "launch",
            platform: PlatformType.iOS,
            enableDebug: false,
        },
        "Run Direct iOS - Experimental": {
            name: "Run Direct iOS - Experimental",
            cwd: "${workspaceFolder}",
            type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
            request: "launch",
            platform: PlatformType.iOS,
            enableDebug: false,
            useHermesEngine: false,
            target: "device",
        },
    };

    private initialPickConfig: ReadonlyArray<vscode.QuickPickItem> = [
        {
            label: "Debug Android",
            description: localize("DebugAndroidConfigDesc", "Run and debug Android application"),
        },
        {
            label: "Run Android",
            description: localize("RunAndroidConfigDesc", "Run Android application"),
        },
        {
            label: "Debug iOS",
            description: localize("DebugiOSConfigDesc", "Run and debug iOS application"),
        },
        {
            label: "Run iOS",
            description: localize("RuniOSConfigDesc", "Run iOS application"),
        },
        {
            label: "Debug Windows",
            description: localize("DebugWindowsConfigDesc", "Run and debug Windows application"),
        },
        {
            label: "Debug macOS",
            description: localize("DebugmacOSConfigDesc", "Run and debug macOS application"),
        },
        {
            label: "Attach to packager",
            description: localize(
                "AttachToPackagerConfigDesc",
                "Attach to already working application packager",
            ),
        },
        {
            label: "Debug in Exponent",
            description: localize(
                "DebugExpoConfigDesc",
                "Debug Expo application or React Native application in Expo",
            ),
        },
        {
            label: "Debug Android Hermes - Experimental",
            description: localize(
                "DebugAndroidHermesConfigDesc",
                "Run and debug Android Hermes application",
            ),
        },
        {
            label: "Run Android Hermes - Experimental",
            description: localize("RunAndroidHermesConfigDesc", "Run Android Hermes application"),
        },
        {
            label: "Debug iOS Hermes - Experimental",
            description: localize(
                "DebugIosHermesConfigDesc",
                "Run and debug iOS Hermes application",
            ),
        },
        {
            label: "Run iOS Hermes - Experimental",
            description: localize("RunIosHermesConfigDesc", "Run iOS Hermes application"),
        },
        {
            label: "Debug macOS Hermes - Experimental",
            description: localize(
                "DebugMacOSHermesConfigDesc",
                "Run and debug macOS Hermes application",
            ),
        },
        {
            label: "Attach to Hermes application - Experimental",
            description: localize(
                "AttachToPackagerHermesConfigDesc",
                "Attach to already working React Native Hermes application on Android directly",
            ),
        },
        {
            label: "Debug Direct iOS - Experimental",
            description: localize(
                "DebugDirectiOSConfigDesc",
                "Run and debug iOS application directly",
            ),
        },
        {
            label: "Run Direct iOS - Experimental",
            description: localize(
                "RunDirectiOSConfigDesc",
                "Run iOS application with direct debugging support",
            ),
        },
        {
            label: "Attach to Direct iOS - Experimental",
            description: localize(
                "AttachToPackageriOSConfigDesc",
                "Attach to already working React Native iOS application directly",
            ),
        },
    ];

    private sequentialPickConfig: ReadonlyArray<DebugConfigurationQuickPickItem> = [
        {
            label: "Run application",
            description: localize(
                "RunApplicationScenario",
                "Run React Native application without debugging",
            ),
            type: DebugScenarioType.RunApp,
        },
        {
            label: "Debug application",
            description: localize("DebugApplicationScenario", "Debug React Native application"),
            type: DebugScenarioType.DebugApp,
        },
        {
            label: "Attach to application",
            description: localize(
                "AttachApplicationScenario",
                "Attach to running React Native application",
            ),
            type: DebugScenarioType.AttachApp,
        },
    ];

    public async provideDebugConfigurations(
        folder: vscode.WorkspaceFolder | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
        token?: vscode.CancellationToken, // eslint-disable-line @typescript-eslint/no-unused-vars
    ): Promise<vscode.DebugConfiguration[]> {
        return new Promise<vscode.DebugConfiguration[]>(resolve => {
            const configPicker = this.prepareDebugConfigPicker();
            const disposables: vscode.Disposable[] = [];
            const pickHandler = () => {
                let chosenConfigsEvent = TelemetryHelper.createTelemetryEvent(
                    "chosenDebugConfigurations",
                );
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
                configPicker,
            );

            configPicker.show();
        });
    }

    public async provideDebugConfigurationSequentially(
        folder: vscode.WorkspaceFolder | undefined,
        token?: vscode.CancellationToken,
    ): Promise<vscode.DebugConfiguration | undefined> {
        const config: Partial<ILaunchRequestArgs> = {};
        const state = { config, scenarioType: DebugScenarioType.DebugApp, folder, token };

        const multiStep = new MultiStepInput<DebugConfigurationState>();
        await multiStep.run((input, s) => this.pickDebugConfiguration(input, s), state);

        if (Object.keys(state.config).length === 0) {
            return;
        } else {
            if (state.config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT) {
                state.config.name = DebugScenarioNameGenerator.createScenarioName(
                    state.scenarioType,
                    state.config.type,
                    state.config.platform,
                    state.config.useHermesEngine !== false,
                    true,
                );
            } else {
                state.config.name = DebugScenarioNameGenerator.createScenarioName(
                    state.scenarioType,
                    state.config.type || DEBUG_TYPES.REACT_NATIVE,
                    state.config.platform,
                );
            }
            return state.config as vscode.DebugConfiguration;
        }
    }

    private async pickDebugConfiguration(
        input: IMultiStepInput<DebugConfigurationState>,
        state: DebugConfigurationState,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        state.config = {};
        const pick = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: localize("DebugConfigQuickPickSequentialLabel", "Select a debug configuration"),
            placeholder: "Debug Configuration",
            activeItem: this.sequentialPickConfig[0],
            items: this.sequentialPickConfig,
        });
        if (pick) {
            const provider = ConfigProviderFactory.create(pick.type);
            return provider.buildConfiguration.bind(provider);
        }
    }

    private gatherDebugScenarios(selectedItems: string[]): vscode.DebugConfiguration[] {
        let launchConfig: vscode.DebugConfiguration[] = selectedItems.map(
            element => this.debugConfigurations[element],
        );
        return launchConfig;
    }

    private prepareDebugConfigPicker(): vscode.QuickPick<vscode.QuickPickItem> {
        const debugConfigPicker = vscode.window.createQuickPick();
        debugConfigPicker.canSelectMany = true;
        debugConfigPicker.ignoreFocusOut = true;
        debugConfigPicker.title = localize(
            "DebugConfigQuickPickLabel",
            "Pick debug configurations",
        );
        debugConfigPicker.items = this.initialPickConfig;
        // QuickPickItem property `picked` doesn't work, so this line will check first item in the list
        // which is supposed to be Debug Android
        debugConfigPicker.selectedItems = [this.initialPickConfig[0]];
        return debugConfigPicker;
    }
}
