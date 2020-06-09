// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Configstore from "configstore";
import * as https from "https";
import { PreviewVersionPromotion} from "./experiments/previewVersionPromotion";
import { TelemetryHelper } from "../../common/telemetryHelper";

export enum ExperimentStatuses {
    FAILURE = "failure",
    SUCCESS = "success",
    SKIPPED = "skipped",
}

export interface ExperimentConfig {
    experimentName: string;
    popCoveragePercent: number;
    enabled: boolean;
}

export interface ExperimentParameters extends ExperimentConfig {
    [key: string]: any;
    extensionId?: string;
}

export interface ExperimentResult {
    resultStatus: ExperimentStatuses;
    updatedExperimentParameters: ExperimentParameters;
}

export class ExperimentService {
    private readonly endpointURL: string;
    private readonly configName: string;
    private readonly availableExperiments: any;
    private config: Configstore;

    constructor() {
        this.endpointURL = "https://microsoft.github.io/vscode-react-native/experiments/experimentsConfig.json";
        this.configName = "reactNativeToolsConfig";
        this.availableExperiments = {
            RNT_PREVIEW_PROMPT: "RNTPreviewPrompt",
        };

        this.config = new Configstore(this.configName);
    }

    public async runExperiments(): Promise<void> {
        let experimentsConfig = [];
        try {
            experimentsConfig = await this.downloadExperimentsConfig();
        } catch (err) {
            throw new Error("Failed to download experiments config");
        }

        let experimentResults: Array<ExperimentResult> = await Promise.all(experimentsConfig
            .filter(expConfig => expConfig.enabled)
            .map(async (expConfig) => await this.executeExperiment(expConfig))
        );

        this.sendExperimentTelemetry(experimentResults);
    }

    private async executeExperiment(expConfig: ExperimentConfig): Promise<ExperimentResult> {
        let curExperimentParameters = this.config.get(expConfig.experimentName);
        let expResult: ExperimentResult;

        try {
            switch (expConfig.experimentName) {
                case this.availableExperiments.RNT_PREVIEW_PROMPT:
                    let previewPromptExp = new PreviewVersionPromotion();
                    expResult = await previewPromptExp.run(expConfig, curExperimentParameters);
                    break;
                default:
                    throw new Error("Cannot run the experiment. There is no such experiment.");
            }
        } catch (err) {
            return {
                resultStatus: ExperimentStatuses.FAILURE,
                updatedExperimentParameters: expConfig,
            };
        }

        this.config.set(expConfig.experimentName, expResult.updatedExperimentParameters);
        return expResult;
    }

    private downloadExperimentsConfig(): Promise<ExperimentConfig[]> {
        return new Promise<ExperimentConfig[]>((resolve, reject) => {
            https.get(this.endpointURL, (response) => {
                let data = "";
                response.setEncoding("utf8");
                response.on("data", (chunk: string) => (data += chunk));
                response.on("end", () => resolve(JSON.parse(data)));
                response.on("error", reject);
            }).on("error", reject);
        });
    }

    private sendExperimentTelemetry(experimentsResults: ExperimentResult[]): void {
        const telemetryProps = experimentsResults.reduce((tProps, expResult) => {
            return Object.assign(
                tProps,
                {
                    [expResult.updatedExperimentParameters.experimentName]: expResult.resultStatus,
                }
            );
        }, {});

        TelemetryHelper.sendSimpleEvent("runExperiments", telemetryProps);
    }
}
