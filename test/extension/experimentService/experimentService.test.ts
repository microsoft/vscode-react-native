// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    ExperimentService,
    ExperimentConfig,
    ExperimentStatuses,
    ExperimentResult,
} from "../../../src/extension/services/experimentService/experimentService";
import { ExtensionConfigManager } from "../../../src/extension/extensionConfigManager";
import assert = require("assert");

suite("experimentService", function () {
    const testExperimentName = "testName";
    const rntPreviewPromptExpName = "RNTPreviewPrompt";
    const remoteExperimentConfig = {
        experimentName: rntPreviewPromptExpName,
        popCoveragePercent: 1,
        enabled: true,
    };
    const configData: Record<string, unknown> = {};
    const config = {
        get: (key: string) => configData[key],
        set: (key: string, value: unknown) => {
            configData[key] = value;
        },
        delete: (key: string) => {
            delete configData[key];
        },
    };

    teardown(() => {
        (<any>ExperimentService).instance = null;
        config.delete(testExperimentName);
        config.delete(rntPreviewPromptExpName);
    });

    suite("initializationAndExperimentConfig", function () {
        test("should return correct experiment config", async () => {
            let experimentService = ExperimentService.create();
            (<any>experimentService).downloadConfigRequest = Promise.resolve([
                remoteExperimentConfig,
            ]);
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
            experimentName: rntPreviewPromptExpName,
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
            (<any>ExperimentService).instance = null;
            config.delete(testExperimentName);
            config.delete(rntPreviewPromptExpName);
        });

        test("should skip the experiment", async () => {
            (<any>ExtensionConfigManager).config = config;
            config.set(testExperimentName, expTestConfig);
            let experimentService = <any>ExperimentService.create();
            await configureExperimentService(experimentService, expTestConfig);
            let experimentResult: ExperimentResult = await experimentService.executeExperiment(
                expTestConfig,
            );
            assert.strictEqual(experimentResult.resultStatus, ExperimentStatuses.DISABLED);
        });

        test("should succeed the experiment", async () => {
            (<any>ExtensionConfigManager).config = config;
            let experimentService = <any>ExperimentService.create();
            await configureExperimentService(experimentService, RNTPreviewPromptExp);
            let experimentResult: ExperimentResult = await experimentService.executeExperiment(
                RNTPreviewPromptExp,
            );
            assert.strictEqual(experimentResult.resultStatus, ExperimentStatuses.ENABLED);
        });
    });
});
