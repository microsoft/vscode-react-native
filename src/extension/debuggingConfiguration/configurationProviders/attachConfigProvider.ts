// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { BaseConfigProvider } from "./baseConfigProvider";
import { MultiStepInput, InputStep } from "../multiStepInput";
import { ILaunchRequestArgs } from "../../../debugger/debugSessionBase";
import {
    DebugConfigurationState,
    platformTypeDirectPickConfig,
    DEBUG_TYPES,
    DebugScenarioType,
} from "../debugConfigTypesAndConstants";

export class AttachConfigProvider extends BaseConfigProvider {
    private readonly defaultAddress: string;

    constructor() {
        super();
        this.defaultAddress = "localhost";
        this.maxStepCount = 3;
    }

    public async buildConfiguration(
        input: MultiStepInput<DebugConfigurationState>,
        state: DebugConfigurationState,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        this.maxStepCount = 3;
        state.config = {};
        const config: Partial<ILaunchRequestArgs> = {
            name: "Attach to application",
            request: "attach",
            type: DEBUG_TYPES.REACT_NATIVE,
            cwd: "${workspaceFolder}",
        };

        state.scenarioType = DebugScenarioType.AttachApp;

        await this.configurationProviderHelper.selectApplicationType(
            input,
            config,
            1,
            this.maxStepCount,
        );

        Object.assign(state.config, config);

        if (state.config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT) {
            this.maxStepCount++;
            return () => this.configureDirectPlatform(input, state.config);
        } else {
            return () => this.configureAddress(input, state.config);
        }
    }

    private async configureDirectPlatform(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        delete config.platform;
        await this.configurationProviderHelper.selectPlatform(
            input,
            config,
            platformTypeDirectPickConfig,
            2,
            this.maxStepCount,
        );

        if (!config.platform) {
            delete config.platform;
            delete config.useHermesEngine;
        } else {
            config.useHermesEngine = false;
        }

        return () => this.configureAddress(input, config);
    }

    private async configureAddress(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        await this.configurationProviderHelper.configureAddress(
            input,
            config,
            config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT ? 3 : 2,
            this.maxStepCount,
            this.defaultAddress,
        );
        return () => this.configurePort(input, config);
    }

    private async configurePort(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        await this.configurationProviderHelper.configurePort(
            input,
            config,
            config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT ? 4 : 3,
            this.maxStepCount,
        );
    }
}
