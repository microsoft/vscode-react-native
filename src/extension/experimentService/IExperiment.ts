// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ExperimentResult, ExperimentConfig, ExperimentParameters } from "./experimentService";

export interface IExperiment {
    run: (
        newExpConfig: ExperimentConfig,
        curExpParameters?: ExperimentParameters,
    ) => Promise<ExperimentResult>;
}
