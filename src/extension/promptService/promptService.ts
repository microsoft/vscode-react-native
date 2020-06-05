// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Configstore from "configstore";
import * as vscode from "vscode";
import * as https from "https";
import { PROMPT_TITLES } from "./promptStrings";

export interface PromptParameters {
    promptShown: boolean;
    threshold: number;
    experimentName: string;
    extensionId: string;
}

export class PromptService {
    private readonly endpointURL: string;
    private readonly configName: string;
    private readonly experimentName: string;
    private config: Configstore;

    constructor() {
        this.endpointURL = "https://microsoft.github.io/vscode-react-native/experiments/experimentsConfig.json";
        this.configName = "reactNativeToolsConfig";
        this.experimentName = "RNTPreview";
        this.config = new Configstore(this.configName);
    }

    public showPromptIfNeeded(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            https.get(this.endpointURL, (response) => {
                let data = "";
                response.setEncoding("utf8");
                response.on("data", (chunk: string) => (data += chunk));
                response.on("end", () => resolve(JSON.parse(data)));
                response.on("error", reject);
            }).on("error", reject);
        })
        .then((promptConfig: any) => {
            let promptParameters: PromptParameters | undefined = this.config.get(this.experimentName);

            if (promptParameters) {
                if (promptParameters.promptShown) {
                    return;
                } else if (promptConfig.RNTPreview !== promptParameters.threshold) {
                    this.showPrompIfThresholdIsNotExceeded(promptConfig, promptParameters);
                }
            }

            this.showPrompIfThresholdIsNotExceeded(promptConfig, promptParameters);
        });
    }

    private showPrompIfThresholdIsNotExceeded(promptConfig: any, promptParameters?: PromptParameters) {
        if (promptParameters) {
            promptParameters.threshold = promptConfig.RNTPreview;
        } else {
            promptParameters = {
                promptShown: false,
                threshold: promptConfig.RNTPreview,
                experimentName: this.experimentName,
                extensionId: "msjsdiag.vscode-react-native-preview",
            };
        }

        if (promptConfig.RNTPreview > Math.random()) {
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

        this.config.set(this.experimentName, promptParameters);
    }
}
