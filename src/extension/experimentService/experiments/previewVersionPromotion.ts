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

        const updatedExperimentParameters = this.showPrompt(newExpConfig, curExpParameters);

        return {
            resultStatus: ExperimentStatuses.SUCCESS,
            updatedExperimentParameters,
        };
    }

    public skip(newExpConfig: ExperimentConfig, curExpParameters?: ExperimentParameters): ExperimentResult {
        const updatedExperimentParameters = this.preUpdatePromptParameters(newExpConfig, curExpParameters);
        return {
            resultStatus: ExperimentStatuses.SKIPPED,
            updatedExperimentParameters,
        };
    }

    private showPrompt(newExpConfig: ExperimentConfig, promptParameters?: ExperimentParameters) {
        promptParameters = this.preUpdatePromptParameters(newExpConfig, promptParameters);

        const buttonText = "Open extension";
        vscode.window.showInformationMessage(PROMPT_TITLES.RNT_PREVIEW_PROMPT, buttonText)
            .then(selection => {
                if (selection === buttonText && promptParameters) {
                    vscode.commands.executeCommand("workbench.extensions.search", promptParameters.extensionId);
                    vscode.commands.executeCommand("extension.open", promptParameters.extensionId);
                }
            });
        promptParameters.promptShown = true;
        return promptParameters;
    }

    private preUpdatePromptParameters(newExpConfig: ExperimentConfig, promptParameters?: ExperimentParameters): ExperimentParameters {
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

        return promptParameters;
    }
}
