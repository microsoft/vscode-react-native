// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    ExperimentService,
    ExperimentConfig,
    ExperimentStatuses,
    ExperimentResult,
} from "../../../src/extension/services/experimentService/experimentService";
import * as Configstore from "configstore";
import * as assert from "assert";

suite("experimentService", function () {
    const configName = "reactNativeToolsConfig";
    const testExperimentName = "testName";
    const config = new Configstore(configName);

    teardown(() => {
        (<any>ExperimentService).instance = null;
    });

    suite("initializationAndExperimentConfig", function () {
        test("should return correct experiment config", async () => {
            let experimentService = ExperimentService.create();
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
            (<any>ExperimentService).instance = null;
            config.delete(testExperimentName);
            config.delete(RNTPreviewPromptExp.experimentName);
        });

        test("should skip the experiment", async () => {
            config.set(testExperimentName, expTestConfig);
            let experimentService = <any>ExperimentService.create();
            await configureExperimentService(experimentService, expTestConfig);
            let experimentResult: ExperimentResult = await experimentService.executeExperiment(
                expTestConfig,
            );
            assert.strictEqual(experimentResult.resultStatus, ExperimentStatuses.DISABLED);
        });

        test("should succeed the experiment", async () => {
            let experimentService = <any>ExperimentService.create();
            await configureExperimentService(experimentService, RNTPreviewPromptExp);
            let experimentResult: ExperimentResult = await experimentService.executeExperiment(
                RNTPreviewPromptExp,
            );
            assert.strictEqual(experimentResult.resultStatus, ExperimentStatuses.ENABLED);
        });
    });
});
