// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { RunConfigProvider } from "./runConfigProvider";
import { DebugConfigProvider } from "./debugConfigProvider";
import { AttachConfigProvider } from "./attachConfigProvider";
import { DebugScenarioType } from "../debugConfigTypesAndConstants";
import { BaseConfigProvider } from "./baseConfigProvider";

export class ConfigProviderFactory {
    public static create(configurationType: string): BaseConfigProvider {
        switch (configurationType) {
            case DebugScenarioType.RunApp:
                return new RunConfigProvider();
            case DebugScenarioType.DebugApp:
                return new DebugConfigProvider();
            case DebugScenarioType.AttachApp:
                return new AttachConfigProvider();
            default:
                throw new Error(`Couldn't find ${configurationType} config adapter type`);
        }
    }
}
