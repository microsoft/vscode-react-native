// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    ExperimentService,
    ExperimentConfig,
    ExperimentStatuses,
    ExperimentResult
} from "../../../src/extension/experimentService/experimentService";
import * as Configstore from "configstore";
import * as assert from "assert";

suite("experimentService", function () {
    const configName = "reactNativeToolsConfig";
    const experimentName = "testName";
    const config = new Configstore(configName);

    suiteTeardown(() => {
        config.delete(experimentName);
    });

    suite("initializationAndExperimentConfig", function () {
        test("should return correct experiment config", async () => {
            let experimentService = new ExperimentService();
            experimentService.initialize();
            let downloadedExperimentsConfig: ExperimentConfig[] = await (<any>experimentService).downloadConfigRequest;

            let result = downloadedExperimentsConfig.every(expConfig =>
                typeof expConfig.enabled === "boolean"
                && typeof expConfig.experimentName === "string"
                && typeof expConfig.popCoveragePercent === "number"
            );

            assert.equal(result, true);
        });
    });

    suite("executeExperiment", function () {
        let expConfig = {
            experimentName: experimentName,
            popCoveragePercent: 0.5,
            enabled: true,
        };

        teardown(() => {
            config.delete(experimentName);
        });

        test("should skip the experiment", async () => {
            config.set(experimentName, expConfig);
            let experimentService = <any>(new ExperimentService());
            let experimentResult: ExperimentResult = await experimentService.executeExperiment(expConfig);
            assert.equal(experimentResult.resultStatus, ExperimentStatuses.SKIPPED);
        });

        test("should fail the experiment", async () => {
            let experimentService = <any>(new ExperimentService());
            let experimentResult: ExperimentResult = await experimentService.executeExperiment(expConfig);
            assert.equal(experimentResult.resultStatus, ExperimentStatuses.FAILURE);
        });
    });
});
