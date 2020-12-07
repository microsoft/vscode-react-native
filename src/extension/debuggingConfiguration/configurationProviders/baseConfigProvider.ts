// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { MultiStepInput, InputStep } from "../multiStepInput";
import { DebugConfigurationState } from "../debugConfigTypesAndConstants";
import { ConfigurationProviderHelper } from "../../../common/configurationProviderHelper";

export abstract class BaseConfigProvider {
    protected configurationProviderHelper: ConfigurationProviderHelper;
    protected currentStepNumber: number;
    protected maxStepCount: number;

    constructor() {
        this.configurationProviderHelper = new ConfigurationProviderHelper();
    }

    public abstract async buildConfiguration(
        input: MultiStepInput<DebugConfigurationState>,
        state: DebugConfigurationState,
    ): Promise<InputStep<DebugConfigurationState> | void>;
}
