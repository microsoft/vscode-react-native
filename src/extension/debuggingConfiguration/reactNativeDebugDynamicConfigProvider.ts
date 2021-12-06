// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { SettingsHelper } from "../settingsHelper";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { Telemetry } from "../../common/telemetry";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { ReactNativeProjectHelper } from "../../common/reactNativeProjectHelper";
import { PlatformType } from "../launchArgs";
import { ILaunchRequestArgs } from "../../debugger/debugSessionBase";
import { ConfigurationProviderHelper } from "../../common/configurationProviderHelper";
import { MultiStepInput, InputStep } from "./multiStepInput";
import {
    debugConfigurations,
    DEBUG_CONFIGURATION_NAMES,
    DebugScenarioType,
    DebugConfigurationState,
} from "./debugConfigTypesAndConstants";

export class ReactNativeDebugDynamicConfigProvider implements vscode.DebugConfigurationProvider {
    public async provideDebugConfigurations(
        folder: vscode.WorkspaceFolder | undefined,
        token?: vscode.CancellationToken, // eslint-disable-line @typescript-eslint/no-unused-vars
    ): Promise<vscode.DebugConfiguration[]> {
        const debugConfigurationsToShow = Object.assign({}, debugConfigurations);

        if (folder) {
            const rootPath = folder.uri.fsPath;
            const projectRootPath = SettingsHelper.getReactNativeProjectRoot(rootPath);
            const versions =
                await ProjectVersionHelper.tryToGetRNSemverValidVersionsFromProjectPackage(
                    projectRootPath,
                    ProjectVersionHelper.generateAllAdditionalPackages(),
                    projectRootPath,
                );

            let macOSHermesEnabled = false;
            let windowsHermesEnabled = false;
            const androidHermesEnabled = ReactNativeProjectHelper.isAndroidHermesEnabled(rootPath);
            const iOSHermesEnabled = ReactNativeProjectHelper.isIOSHermesEnabled(rootPath);

            if (ProjectVersionHelper.isVersionError(versions.reactNativeWindowsVersion)) {
                delete debugConfigurationsToShow[DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS];
                delete debugConfigurationsToShow[
                    DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS_HERMES_EXPERIMENTAL
                ];
            } else {
                windowsHermesEnabled = ReactNativeProjectHelper.isWindowsHermesEnabled(rootPath);
                if (!windowsHermesEnabled) {
                    delete debugConfigurationsToShow[
                        DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS_HERMES_EXPERIMENTAL
                    ];
                }
            }

            if (ProjectVersionHelper.isVersionError(versions.reactNativeMacOSVersion)) {
                delete debugConfigurationsToShow[DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS];
                delete debugConfigurationsToShow[
                    DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS_HERMES_EXPERIMENTAL
                ];
            } else {
                macOSHermesEnabled = ReactNativeProjectHelper.isMacOSHermesEnabled(rootPath);
                if (!macOSHermesEnabled) {
                    delete debugConfigurationsToShow[
                        DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS_HERMES_EXPERIMENTAL
                    ];
                }
            }

            if (!androidHermesEnabled) {
                delete debugConfigurationsToShow[
                    DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID_HERMES_EXPERIMENTAL
                ];
                delete debugConfigurationsToShow[
                    DEBUG_CONFIGURATION_NAMES.RUN_ANDROID_HERMES_EXPERIMENTAL
                ];
            }

            if (!iOSHermesEnabled) {
                delete debugConfigurationsToShow[
                    DEBUG_CONFIGURATION_NAMES.DEBUG_IOS_HERMES_EXPERIMENTAL
                ];
                delete debugConfigurationsToShow[
                    DEBUG_CONFIGURATION_NAMES.RUN_IOS_HERMES_EXPERIMENTAL
                ];
            }

            if (
                !androidHermesEnabled &&
                !iOSHermesEnabled &&
                !macOSHermesEnabled &&
                !windowsHermesEnabled
            ) {
                delete debugConfigurationsToShow[
                    DEBUG_CONFIGURATION_NAMES.ATTACH_TO_HERMES_APPLICATION_EXPERIMENTAL
                ];
            }
        }

        const debugConfigurationsToShowList = Object.values(debugConfigurationsToShow);
        debugConfigurationsToShowList.forEach(config => {
            config.isDynamic = true;
        });

        return debugConfigurationsToShowList;
    }

    public async resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        token?: vscode.CancellationToken,
    ): Promise<vscode.ProviderResult<vscode.DebugConfiguration>> {
        if (config.isDynamic) {
            const chosenConfigsEvent = TelemetryHelper.createTelemetryEvent(
                "chosenDynamicDebugConfiguration",
                {
                    selectedConfiguration: config.name,
                },
            );
            Telemetry.send(chosenConfigsEvent);
            if (config.request === "attach") {
                await this.configureAttachScenario(folder, config, token);
            }
            if (config.platform === PlatformType.Exponent) {
                await this.configureExpoScenario(folder, config, token);
            }
        }

        return config;
    }

    private async configureExpoScenario(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        token?: vscode.CancellationToken,
    ): Promise<vscode.DebugConfiguration> {
        const state = { config, scenarioType: DebugScenarioType.DebugApp, folder, token };
        const picker = new MultiStepInput<DebugConfigurationState>();
        const configurationProviderHelper = new ConfigurationProviderHelper();
        await picker.run(async (input, s) => {
            await configurationProviderHelper.selectExpoHostType(input, s.config, 1, 1);
        }, state);

        return config;
    }

    private async configureAttachScenario(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        token?: vscode.CancellationToken,
    ): Promise<vscode.DebugConfiguration> {
        const state = { config, scenarioType: DebugScenarioType.AttachApp, folder, token };
        const picker = new MultiStepInput<DebugConfigurationState>();
        const configurationProviderHelper = new ConfigurationProviderHelper();

        const configurePort = async (
            input: MultiStepInput<DebugConfigurationState>,
            config: Partial<ILaunchRequestArgs>,
        ): Promise<InputStep<DebugConfigurationState> | void> => {
            await configurationProviderHelper.configurePort(input, config, 2, 2);
        };

        const configureAddress = async (
            input: MultiStepInput<DebugConfigurationState>,
            config: Partial<ILaunchRequestArgs>,
        ): Promise<InputStep<DebugConfigurationState> | void> => {
            await configurationProviderHelper.configureAddress(input, config, 1, 2, "localhost");
            return () => configurePort(input, config);
        };

        await picker.run((input, s) => configureAddress(input, s.config), state);

        return config;
    }
}
