// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    MultiStepInput,
    IQuickPickParameters,
} from "../extension/debuggingConfiguration/multiStepInput";
import { ILaunchRequestArgs } from "../debugger/debugSessionBase";
import { ExpoHostType } from "../extension/launchArgs";
import {
    DebugConfigurationState,
    DebugConfigurationQuickPickItem,
    appTypePickConfig,
    expoHostTypePickConfig,
} from "../extension/debuggingConfiguration/debugConfigTypesAndConstants";

export class ConfigurationProviderHelper {
    public async selectPlatform(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
        platformTypePickConfig: DebugConfigurationQuickPickItem[],
        step: number,
        totalSteps: number,
    ): Promise<Partial<ILaunchRequestArgs>> {
        let pick = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: "Select platform",
            placeholder: "Platform to run on",
            step,
            totalSteps,
            items: platformTypePickConfig,
            activeItem: platformTypePickConfig[0],
        });

        if (!pick) {
            throw new Error("Platform is not selected");
        }

        config.platform = pick.type;
        return config;
    }

    public async selectApplicationType(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
        step: number,
        totalSteps: number,
    ): Promise<Partial<ILaunchRequestArgs>> {
        let pick = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: "Select type of React Native application",
            placeholder: "Type of React Native application",
            step,
            totalSteps,
            items: appTypePickConfig,
            activeItem: appTypePickConfig[0],
        });

        if (!pick) {
            throw new Error("Application type is not selected");
        }

        config.type = pick.type;
        return config;
    }

    public async selectExpoHostType(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
        step: number,
        totalSteps: number,
    ): Promise<Partial<ILaunchRequestArgs>> {
        let pick = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: "Select type of Expo host parameter",
            placeholder: "Type of Expo host parameter",
            step,
            totalSteps,
            items: expoHostTypePickConfig,
            activeItem: expoHostTypePickConfig[0],
        });

        if (!pick) {
            throw new Error("Expo host type is not selected");
        }

        config.expoHostType = pick.type as ExpoHostType;
        return config;
    }
}
