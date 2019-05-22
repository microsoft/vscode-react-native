// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { GeneralMobilePlatform } from "../../src/extension/generalMobilePlatform";

suite("generalMobilePlatform", function () {
    suite("extensionContext", function () {
        suite("getOptFromRunArgs", function() {
            test("should return undefined if arguments are empty", function () {
                const args: any[] = [];
                assert.strictEqual(GeneralMobilePlatform.getOptFromRunArgs(args, "--param1", true), undefined);
            });

            test("should return correct result for binary parameters", function () {
                const args: any[] = ["--param1", "param2"];
                assert.strictEqual(GeneralMobilePlatform.getOptFromRunArgs(args, "--param1", true), true);
                assert.strictEqual(GeneralMobilePlatform.getOptFromRunArgs(args, "param2", true), true);
                assert.strictEqual(GeneralMobilePlatform.getOptFromRunArgs(args, "--unknown", true), undefined);
            });

            test("should return correct result for non-binary parameters", function () {
                const args: any[] = ["--param1", "value1", "--param2=value2", "param3=value3", "param4value4"];
                assert.equal(GeneralMobilePlatform.getOptFromRunArgs(args, "--param1", false), "value1");
                assert.equal(GeneralMobilePlatform.getOptFromRunArgs(args, "--param2", false), "value2");
                assert.equal(GeneralMobilePlatform.getOptFromRunArgs(args, "--param1"), "value1");
                assert.equal(GeneralMobilePlatform.getOptFromRunArgs(args, "--param2"), "value2");
                assert.equal(GeneralMobilePlatform.getOptFromRunArgs(args, "param3", false), "value3");
                assert.equal(GeneralMobilePlatform.getOptFromRunArgs(args, "param4", false), undefined);
            });
        });
    });
});
