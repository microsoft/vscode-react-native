// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { MultiStepInput, InputStep } from "../multiStepInput";
import {
    DebugConfigurationState,
    platformTypeDebugPickConfig,
    DEBUG_TYPES,
    DebugScenarioType,
} from "../debugConfigTypesAndConstants";
import { PlatformType } from "../../launchArgs";
import { ILaunchRequestArgs } from "../../../debugger/debugSessionBase";
import { BaseConfigProvider } from "./baseConfigProvider";

export class DebugConfigProvider extends BaseConfigProvider {
    constructor() {
        super();
        this.maxStepCount = 2;
    }

    public async buildConfiguration(
        input: MultiStepInput<DebugConfigurationState>,
        state: DebugConfigurationState,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        state.config = {};
        const config: Partial<ILaunchRequestArgs> = {
            name: "Debug application",
            request: "launch",
            type: DEBUG_TYPES.REACT_NATIVE,
            cwd: "${workspaceFolder}",
        };

        state.scenarioType = DebugScenarioType.DebugApp;

        await this.configurationProviderHelper.selectPlatform(
            input,
            config,
            platformTypeDebugPickConfig,
            1,
            this.maxStepCount,
        );

        Object.assign(state.config, config);

        if (
            state.config.platform !== PlatformType.Exponent &&
            state.config.platform !== PlatformType.ExpoWeb
        ) {
            return async () => {
                await this.configureApplicationType(input, state.config);
                if (
                    state.config.platform === PlatformType.iOS &&
                    state.config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT
                ) {
                    this.maxStepCount = 3;
                    await this.configureUseHermesEngine(input, state.config);
                    // Direct iOS debugging using ios-webkit-debug-proxy is supported
                    // only with applications running on the device
                    if (state.config.useHermesEngine === false) {
                        state.config.target = "device";
                    }
                }
            };
        } else if (state.config.platform === PlatformType.Exponent) {
            return async () => {
                await this.configureApplicationType(input, state.config);
                await this.configureExpoHostType(input, state.config);
            };
        } else if (state.config.platform === PlatformType.ExpoWeb) {
            return async () => {
                await this.configureBrowserTarget(input, state.config);
                await this.configureApplicationType(input, state.config);
                state.config.url = "http://localhost:8081";
            };
        }
        return;
    }

    private async configureApplicationType(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        await this.configurationProviderHelper.selectApplicationType(
            input,
            config,
            2,
            this.maxStepCount,
        );
    }

    private async configureExpoHostType(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        await this.configurationProviderHelper.selectExpoHostType(
            input,
            config,
            2,
            this.maxStepCount,
        );
    }

    private async configureUseHermesEngine(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        delete config.useHermesEngine;
        await this.configurationProviderHelper.shouldUseHermesEngine(
            input,
            config,
            3,
            this.maxStepCount,
        );
        if (config.useHermesEngine) {
            delete config.useHermesEngine;
        }
    }

    private async configureBrowserTarget(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        await this.configurationProviderHelper.selectBrowserTarget(
            input,
            config,
            4,
            this.maxStepCount,
        );
    }
}
