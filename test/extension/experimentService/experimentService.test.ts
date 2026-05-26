// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import type {
    ExperimentService as ExperimentServiceType,
    ExperimentConfig,
    ExperimentResult,
} from "../../../src/extension/services/experimentService/experimentService";
import assert = require("assert");
import proxyquire = require("proxyquire");

const experimentServicePath = "../../../src/extension/services/experimentService/experimentService";

class TestConfigstore {
    private values: Record<string, unknown> = {};

    public get<T>(key: string): T {
        return this.clone(this.values[key]) as T;
    }

    public set(key: string, value: unknown): void {
        this.values[key] = this.clone(value);
    }

    public delete(key: string): void {
        delete this.values[key];
    }

    private clone(value: unknown): unknown {
        return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    }
}

const config = new TestConfigstore();

type ExperimentServiceModule =
    typeof import("../../../src/extension/services/experimentService/experimentService");

const mockedExperimentsConfig: ExperimentConfig[] = [
    {
        experimentName: "RNTPreviewPrompt",
        popCoveragePercent: 1,
        enabled: true,
    },
];

const experimentServiceModule = proxyquire(experimentServicePath, {
    "../remoteConfigHelper": {
        retryDownloadConfig: () => Promise.resolve(mockedExperimentsConfig),
    },
    "../../extensionConfigManager": {
        ExtensionConfigManager: {
            config,
        },
    },
}) as ExperimentServiceModule;

const { ExperimentService, ExperimentStatuses } = experimentServiceModule;

suite("experimentService", function () {
    const testExperimentName = "testName";
    let experimentService: ExperimentServiceType | undefined;

    function disposeExperimentService(): void {
        if (experimentService) {
            experimentService.dispose();
            experimentService = undefined;
        }
        (<any>ExperimentService).instance = null;
    }

    teardown(disposeExperimentService);

    suite("initializationAndExperimentConfig", function () {
        test("should return correct experiment config", async () => {
            experimentService = ExperimentService.create();
            let downloadedExperimentsConfig: ExperimentConfig[] = await (<any>experimentService)
                .downloadConfigRequest;
            let result = downloadedExperimentsConfig.every(
                expConfig =>
                    typeof expConfig.enabled === "boolean" &&
                    typeof expConfig.experimentName === "string" &&
                    typeof expConfig.popCoveragePercent === "number",
            );

            assert.strictEqual(result, true);
        });
    });

    suite("executeExperiment", function () {
        const expTestConfig = {
            experimentName: testExperimentName,
            popCoveragePercent: 0.5,
            enabled: true,
        };

        const RNTPreviewPromptExp = {
            experimentName: "RNTPreviewPrompt",
            popCoveragePercent: 1,
            enabled: true,
        };

        async function configureExperimentService(
            experimentService: any,
            expConfig: ExperimentConfig,
        ) {
            experimentService.downloadedExperimentsConfig = [expConfig];
            experimentService.experimentsInstances =
                await experimentService.initializeExperimentsInstances();
        }

        teardown(() => {
            config.delete(testExperimentName);
            config.delete(RNTPreviewPromptExp.experimentName);
        });

        test("should skip the experiment", async () => {
            config.set(testExperimentName, expTestConfig);
            experimentService = ExperimentService.create();
            const service = <any>experimentService;
            service.downloadedExperimentsConfig = [expTestConfig];
            service.experimentsInstances = new Map();

            let experimentResult: ExperimentResult = await service.executeExperiment(expTestConfig);
            assert.strictEqual(experimentResult.resultStatus, ExperimentStatuses.DISABLED);
        });

        test("should succeed the experiment", async () => {
            experimentService = ExperimentService.create();
            const service = <any>experimentService;
            await configureExperimentService(service, RNTPreviewPromptExp);
            let experimentResult: ExperimentResult = await service.executeExperiment(
                RNTPreviewPromptExp,
            );
            assert.strictEqual(experimentResult.resultStatus, ExperimentStatuses.ENABLED);
        });
    });
});
