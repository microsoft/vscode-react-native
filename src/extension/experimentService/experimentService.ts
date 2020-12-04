// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Configstore from "configstore";
import * as https from "https";
import * as vscode from "vscode";
import { IExperiment } from "./IExperiment";
import { PromiseUtil } from "../../common/node/promise";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { Telemetry } from "../../common/telemetry";

export enum ExperimentStatuses {
    ENABLED = "enabled",
    DISABLED = "disabled",
    FAILED = "failed",
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
    error?: Error;
}

export class ExperimentService implements vscode.Disposable {
    private static instance: ExperimentService;

    private readonly endpointURL: string;
    private readonly configName: string;
    private config: Configstore;
    private downloadedExperimentsConfig: Array<ExperimentConfig> | null;
    private experimentsInstances: Map<string, IExperiment>;
    private downloadConfigRequest: Promise<ExperimentConfig[]>;
    private cancellationTokenSource: vscode.CancellationTokenSource;

    public static create(): ExperimentService {
        if (!ExperimentService.instance) {
            ExperimentService.instance = new ExperimentService();
        }

        return ExperimentService.instance;
    }

    public async runExperiments(): Promise<void> {
        if (!this.downloadedExperimentsConfig) {
            this.downloadedExperimentsConfig = await this.downloadConfigRequest;
            this.experimentsInstances = await this.initializeExperimentsInstances();
        }

        let experimentResults: Array<ExperimentResult> = await Promise.all(
            this.downloadedExperimentsConfig.map(expConfig => this.executeExperiment(expConfig)),
        );

        this.sendExperimentTelemetry(experimentResults);
    }

    public dispose(): void {
        this.cancellationTokenSource.cancel();
        this.cancellationTokenSource.dispose();
    }

    private constructor() {
        this.endpointURL =
            "https://microsoft.github.io/vscode-react-native/experiments/experimentsConfig.json";
        this.configName = "reactNativeToolsConfig";

        this.config = new Configstore(this.configName);
        this.cancellationTokenSource = new vscode.CancellationTokenSource();
        this.downloadedExperimentsConfig = null;

        this.downloadConfigRequest = this.retryDownloadExperimentsConfig();
    }

    private async executeExperiment(expConfig: ExperimentConfig): Promise<ExperimentResult> {
        let curExperimentParameters = this.config.get(expConfig.experimentName);
        let expInstance = this.experimentsInstances.get(expConfig.experimentName);

        let expResult: ExperimentResult;
        if (expInstance && expConfig.enabled) {
            try {
                expResult = await expInstance.run(expConfig, curExperimentParameters);
                this.config.set(expConfig.experimentName, expResult.updatedExperimentParameters);
            } catch (err) {
                expResult = {
                    resultStatus: ExperimentStatuses.FAILED,
                    updatedExperimentParameters: expConfig,
                    error: err,
                };
            }
        } else {
            expResult = {
                resultStatus: ExperimentStatuses.DISABLED,
                updatedExperimentParameters: expConfig,
            };
        }

        return expResult;
    }

    private async retryDownloadExperimentsConfig(retryCount = 60): Promise<ExperimentConfig[]> {
        try {
            return await this.downloadExperimentsConfig();
        } catch (err) {
            if (retryCount < 1 || this.cancellationTokenSource.token.isCancellationRequested) {
                throw err;
            }

            await PromiseUtil.delay(2000);
            return await this.retryDownloadExperimentsConfig(--retryCount);
        }
    }

    private async initializeExperimentsInstances(): Promise<Map<string, IExperiment>> {
        let expInstances = new Map<string, IExperiment>();

        if (this.downloadedExperimentsConfig) {
            for (let expConfig of this.downloadedExperimentsConfig) {
                try {
                    let expClass = await import(`./experiments/${expConfig.experimentName}`);
                    expInstances.set(expConfig.experimentName, new expClass.default());
                } catch (err) {
                    expConfig.enabled = false;
                }
            }
        }

        return expInstances;
    }

    private downloadExperimentsConfig(): Promise<ExperimentConfig[]> {
        return new Promise<ExperimentConfig[]>((resolve, reject) => {
            https
                .get(this.endpointURL, response => {
                    let data = "";
                    response.setEncoding("utf8");
                    response.on("data", (chunk: string) => (data += chunk));
                    response.on("end", () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (err) {
                            reject(err);
                        }
                    });
                    response.on("error", reject);
                })
                .on("error", reject);
        });
    }

    private sendExperimentTelemetry(experimentsResults: ExperimentResult[]): void {
        const runExperimentsEvent = TelemetryHelper.createTelemetryEvent("runExperiments");

        experimentsResults.forEach(expResult => {
            if (expResult.resultStatus === ExperimentStatuses.FAILED && expResult.error) {
                TelemetryHelper.addTelemetryEventErrorProperty(
                    runExperimentsEvent,
                    expResult.error,
                    undefined,
                    `${expResult.updatedExperimentParameters.experimentName}.`,
                );
            } else {
                TelemetryHelper.addTelemetryEventProperty(
                    runExperimentsEvent,
                    expResult.updatedExperimentParameters.experimentName,
                    expResult.resultStatus,
                    false,
                );
            }
        });

        Telemetry.send(runExperimentsEvent);
    }
}
