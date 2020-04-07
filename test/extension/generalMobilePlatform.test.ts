// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { GeneralMobilePlatform } from "../../src/extension/generalMobilePlatform";
import * as fs from "fs";
import * as path from "path";

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

        suite("getEnvArgument", function() {
            let origEnv: any = {"test1": "origEnv", "test2": "origEnv", "test3": "origEnv"};

            let env: any = {"test2": "env", "test3": "env", "test4": "env"};

            let envForFile: string = "test3=envFile\ntest4=envFile\ntest5=envFile";
            let envFile: string = path.join(__dirname, "../resources/auxiliaryFiles/.env");

            setup(() => {
                fs.writeFileSync(envFile, envForFile);
            });

            teardown(() => {
                fs.unlinkSync(envFile);
            });

            test("existing args should not depends from null or undefined env and envFile", function() {
                assert.deepEqual(GeneralMobilePlatform.getEnvArgument(origEnv, undefined, undefined), {
                    "test1": "origEnv",
                     "test2": "origEnv",
                      "test3": "origEnv"});
            });

            test("args from envFile should not overwrite existing variables", function() {
                assert.deepEqual(GeneralMobilePlatform.getEnvArgument(origEnv, null, envFile), {
                    "test1": "origEnv",
                     "test2": "origEnv",
                      "test3": "origEnv",
                       "test4": "envFile",
                        "test5": "envFile"});
            });

            test("args from envFile and original args should be overwrited by env args", function() {
                assert.deepEqual(GeneralMobilePlatform.getEnvArgument(origEnv, env, envFile), {
                    "test1": "origEnv",
                     "test2": "env",
                      "test3": "env",
                       "test4": "env",
                        "test5": "envFile"});
            });
        });
    });
});
