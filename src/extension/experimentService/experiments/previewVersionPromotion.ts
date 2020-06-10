// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { IExperiment } from "./IExperiment";
import { ExperimentConfig, ExperimentParameters, ExperimentResult, ExperimentStatuses } from "../experimentService";
import { PROMPT_TITLES } from "../experimentsStrings";

export class PreviewVersionPromotion implements IExperiment {

    public async run(newExpConfig: ExperimentConfig, curExpParameters?: ExperimentParameters): Promise<ExperimentResult> {
        if (curExpParameters && curExpParameters.promptShown) {
            return {
                resultStatus: ExperimentStatuses.SKIPPED,
                updatedExperimentParameters: curExpParameters,
            };
        }

        const updatedExperimentParameters = this.showPromptIfThresholdIsNotExceeded(newExpConfig, curExpParameters);

        return {
            resultStatus: ExperimentStatuses.SUCCESS,
            updatedExperimentParameters,
        };
    }

    private showPromptIfThresholdIsNotExceeded(newExpConfig: ExperimentConfig, promptParameters?: ExperimentParameters) {
        if (promptParameters) {
            promptParameters.popCoveragePercent = newExpConfig.popCoveragePercent;
        } else {
            promptParameters = Object.assign(
                {},
                newExpConfig,
                {
                    extensionId: "msjsdiag.vscode-react-native-preview",
                    promptShown: false,
                }
            );
        }

        if (newExpConfig.popCoveragePercent > Math.random()) {
            const buttonText = "Open extension";
            vscode.window.showInformationMessage(PROMPT_TITLES.RNT_PREVIEW_PROMPT, buttonText)
                .then(selection => {
                    if (selection === buttonText && promptParameters) {
                        vscode.commands.executeCommand("workbench.extensions.search", promptParameters.extensionId);
                        vscode.commands.executeCommand("extension.open", promptParameters.extensionId);
                    }
                });

            promptParameters.promptShown = true;
        } else {
            promptParameters.promptShown = false;
        }

        return promptParameters;
    }
}
