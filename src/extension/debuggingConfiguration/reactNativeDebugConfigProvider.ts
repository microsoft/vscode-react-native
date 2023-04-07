// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { Telemetry } from "../../common/telemetry";
import { ILaunchRequestArgs } from "../../debugger/debugSessionBase";
import {
    debugConfigurations,
    DEBUG_CONFIGURATION_NAMES,
    DEBUG_TYPES,
    DebugScenarioType,
    DebugConfigurationQuickPickItem,
    DebugConfigurationState,
} from "./debugConfigTypesAndConstants";
import { DebugScenarioNameGenerator } from "./debugScenarioNameGenerator";

import { MultiStepInput, IMultiStepInput, InputStep, IQuickPickParameters } from "./multiStepInput";
import { ConfigProviderFactory } from "./configurationProviders/configProviderFactory";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class ReactNativeDebugConfigProvider implements vscode.DebugConfigurationProvider {
    private initialPickConfig: ReadonlyArray<vscode.QuickPickItem> = [
        {
            label: DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID,
            description: localize("DebugAndroidConfigDesc", "Run and debug Android application"),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.RUN_ANDROID,
            description: localize("RunAndroidConfigDesc", "Run Android application"),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.DEBUG_IOS,
            description: localize("DebugiOSConfigDesc", "Run and debug iOS application"),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.RUN_IOS,
            description: localize("RuniOSConfigDesc", "Run iOS application"),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS,
            description: localize("DebugWindowsConfigDesc", "Run and debug Windows application"),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS,
            description: localize("DebugmacOSConfigDesc", "Run and debug macOS application"),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.ATTACH_TO_PACKAGER,
            description: localize(
                "AttachToPackagerConfigDesc",
                "Attach to already working application packager",
            ),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.DEBUG_IN_EXPONENT,
            description: localize(
                "DebugExpoConfigDesc",
                "Debug Expo application or React Native application in Expo",
            ),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID_HERMES,
            description: localize(
                "DebugAndroidHermesConfigDesc",
                "Run and debug Android Hermes application",
            ),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.RUN_ANDROID_HERMES,
            description: localize("RunAndroidHermesConfigDesc", "Run Android Hermes application"),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.DEBUG_IOS_HERMES,
            description: localize(
                "DebugIosHermesConfigDesc",
                "Run and debug iOS Hermes application",
            ),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.RUN_IOS_HERMES,
            description: localize("RunIosHermesConfigDesc", "Run iOS Hermes application"),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS_HERMES_EXPERIMENTAL,
            description: localize(
                "DebugMacOSHermesConfigDesc",
                "Run and debug macOS Hermes application",
            ),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS_HERMES_EXPERIMENTAL,
            description: localize(
                "DebugWindowsHermesConfigDesc",
                "Run and debug Windows Hermes application",
            ),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.ATTACH_TO_HERMES_APPLICATION,
            description: localize(
                "AttachToPackagerHermesConfigDesc",
                "Attach to already working React Native Hermes application on Android directly",
            ),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.DEBUG_DIRECT_IOS_EXPERIMENTAL,
            description: localize(
                "DebugDirectiOSConfigDesc",
                "Run and debug iOS application directly",
            ),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.RUN_DIRECT_IOS_EXPERIMENTAL,
            description: localize(
                "RunDirectiOSConfigDesc",
                "Run iOS application with direct debugging support",
            ),
        },
        {
            label: DEBUG_CONFIGURATION_NAMES.ATTACH_TO_DIRECT_IOS_EXPERIMENTAL,
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
                const chosenConfigsEvent = TelemetryHelper.createTelemetryEvent(
                    "chosenDebugConfigurations",
                );
                const selected: string[] = configPicker.selectedItems.map(element => element.label);
                chosenConfigsEvent.properties.selectedItems = selected;
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
        }
        if (state.config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT) {
            if (
                state.config.platform === "android" ||
                (state.config.platform === "ios" &&
                    state.config.target !== "device" &&
                    state.config.request !== "attach")
            ) {
                state.config.name = DebugScenarioNameGenerator.createScenarioName(
                    state.scenarioType,
                    state.config.type,
                    state.config.platform,
                    state.config.useHermesEngine !== false,
                );
            } else {
                state.config.name = DebugScenarioNameGenerator.createScenarioName(
                    state.scenarioType,
                    state.config.type,
                    state.config.platform,
                    state.config.useHermesEngine !== false,
                    true,
                );
            }
        } else {
            state.config.name = DebugScenarioNameGenerator.createScenarioName(
                state.scenarioType,
                state.config.type || DEBUG_TYPES.REACT_NATIVE,
                state.config.platform,
            );
        }
        return state.config as vscode.DebugConfiguration;
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
        const launchConfig: vscode.DebugConfiguration[] = selectedItems.map(
            element => debugConfigurations[element],
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
