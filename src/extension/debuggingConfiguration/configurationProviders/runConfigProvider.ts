// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { BaseConfigProvider } from "./baseConfigProvider";
import { MultiStepInput, InputStep } from "../multiStepInput";
import {
    DebugConfigurationState,
    platformTypeRunPickConfig,
    DEBUG_TYPES,
    DebugScenarioType,
} from "../debugConfigTypesAndConstants";
import { PlatformType } from "../../launchArgs";
import { ILaunchRequestArgs } from "../../../debugger/debugSessionBase";

export class RunConfigProvider extends BaseConfigProvider {
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
            name: "Run application",
            request: "launch",
            type: DEBUG_TYPES.REACT_NATIVE,
            cwd: "${workspaceFolder}",
            enableDebug: false,
        };

        state.scenarioType = DebugScenarioType.RunApp;

        await this.configurationProviderHelper.selectPlatform(
            input,
            config,
            platformTypeRunPickConfig,
            1,
            this.maxStepCount,
        );

        Object.assign(state.config, config);

        if (
            state.config.platform === PlatformType.iOS ||
            state.config.platform === PlatformType.Android
        ) {
            return () =>
                this.configureApplicationType(input, state.config).then(() => {
                    if (
                        state.config.platform === PlatformType.iOS &&
                        state.config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT
                    ) {
                        this.maxStepCount = 3;
                        return this.configureUseHermesEngine(input, state.config).then(() => {
                            // Direct iOS debugging using ios-webkit-debug-proxy is supported
                            // only with applications running on the device
                            if (state.config.useHermesEngine === false) {
                                state.config.target = "device";
                            }
                        });
                    }
                    return Promise.resolve();
                });
        } else {
            return;
        }
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
}
