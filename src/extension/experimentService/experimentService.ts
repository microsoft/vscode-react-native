// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Configstore from "configstore";
import * as https from "https";
import * as glob from "glob";
import * as vscode from "vscode";
import * as path from "path";
import { getFileNameWithoutExtension } from "../../common/utils";
import { IExperiment } from "./IExperiment";
import { PromiseUtil } from "../../common/node/promise";
import { TelemetryHelper } from "../../common/telemetryHelper";

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
}

export class ExperimentService implements vscode.Disposable {
    private static instance: ExperimentService;

    private readonly endpointURL: string;
    private readonly configName: string;
    private config: Configstore;
    private downloadedExperimentsConfig: Array<ExperimentConfig> | null;
    private experimentsInstances: Map<string, IExperiment>;
    private downloadConfigRequest: Promise<ExperimentConfig[]>;
    private promiseUtil: PromiseUtil;
    private cancellationTokenSource: vscode.CancellationTokenSource;

    public static create () {
        if (!ExperimentService.instance) {
            ExperimentService.instance = new ExperimentService();
        }

        return ExperimentService.instance;
    }

    public async runExperiments(): Promise<void> {
        if (!this.downloadedExperimentsConfig) {
            this.downloadedExperimentsConfig = await this.downloadConfigRequest;
        }

        let experimentResults: Array<ExperimentResult> = await Promise.all(this.downloadedExperimentsConfig
            .map(async (expConfig) => await this.executeExperiment(expConfig))
        );

        this.sendExperimentTelemetry(experimentResults);
    }

    public dispose() {
        this.cancellationTokenSource.cancel();
        this.cancellationTokenSource.dispose();
    }

    private constructor() {
        this.endpointURL = "https://microsoft.github.io/vscode-react-native/experiments/experimentsConfig.json";
        this.configName = "reactNativeToolsConfig";

        this.promiseUtil = new PromiseUtil();
        this.config = new Configstore(this.configName);
        this.cancellationTokenSource = new vscode.CancellationTokenSource();
        this.downloadedExperimentsConfig = null;

        this.experimentsInstances = this.initializeExperimentsInstances();
        this.downloadConfigRequest = this.retryDownloadExperimentsConfig();
    }

    private getAvailableExperiments(): Array<string> {
        const cwd = path.join(__dirname, "experiments");
        return glob.sync("*.js", { cwd })
        .map(fullExpName => path.join(cwd, fullExpName));
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

            await this.promiseUtil.delay(2000);
            return await this.retryDownloadExperimentsConfig(--retryCount);
        }
    }

    private initializeExperimentsInstances(): Map<string, IExperiment> {
        let expInstances = new Map<string, IExperiment>();
        const availableExperiments = this.getAvailableExperiments();

        availableExperiments.forEach(expPath => {
            let expClass = require(expPath);
            expInstances.set(
                getFileNameWithoutExtension(expPath),
                new expClass.default()
            );
        });

        return expInstances;
    }

    private downloadExperimentsConfig(): Promise<ExperimentConfig[]> {
        return new Promise<ExperimentConfig[]>((resolve, reject) => {
            https.get(this.endpointURL, (response) => {
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
