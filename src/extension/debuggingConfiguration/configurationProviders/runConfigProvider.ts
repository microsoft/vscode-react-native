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
        this.currentStepNumber = 1;
    }

    public async buildConfiguration(
        input: MultiStepInput<DebugConfigurationState>,
        state: DebugConfigurationState,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        state.config = {
            name: "Run application",
            request: "launch",
            type: DEBUG_TYPES.REACT_NATIVE,
            cwd: "${workspaceFolder}",
            enableDebug: false,
        };

        state.scenarioType = DebugScenarioType.RunApp;

        await this.configurationProviderHelper.selectPlatform(
            input,
            state.config,
            platformTypeRunPickConfig,
            this.currentStepNumber++,
            this.maxStepCount,
        );

        if (
            state.config.platform === PlatformType.iOS ||
            state.config.platform === PlatformType.Android
        ) {
            return () => this.configureApplicationType(input, state.config);
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
            this.currentStepNumber++,
            this.maxStepCount,
        );
    }
}
