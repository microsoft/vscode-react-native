// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { GeneralMobilePlatform } from "../../src/extension/generalMobilePlatform";
import * as fs from "fs";
import * as path from "path";

suite("generalMobilePlatform", function () {
    suite("extensionContext", function () {
        suite("getEnvArgument", function () {
            const origEnv: any = { test1: "origEnv", test2: "origEnv", test3: "origEnv" };

            const env: any = { test2: "env", test3: "env", test4: "env" };

            const envForFile: string = "test3=envFile\ntest4=envFile\ntest5=envFile";
            const envFile: string = path.join(
                __dirname,
                "..",
                "resources",
                "auxiliaryFiles",
                ".env",
            );
            const fakeEnvFile: string = path.join(
                __dirname,
                "..",
                "resources",
                "auxiliaryFiles",
                ".envFake",
            );

            setup(() => {
                fs.writeFileSync(envFile, envForFile);
            });

            teardown(() => {
                fs.unlinkSync(envFile);
            });

            test("existing args should not should not depend on the existence of the envFile", function () {
                assert.deepEqual(
                    GeneralMobilePlatform.getEnvArgument(origEnv, undefined, fakeEnvFile),
                    {
                        test1: "origEnv",
                        test2: "origEnv",
                        test3: "origEnv",
                    },
                );
            });

            test("existing args should not depend on null or undefined env and envFile", function () {
                assert.deepEqual(
                    GeneralMobilePlatform.getEnvArgument(origEnv, undefined, undefined),
                    {
                        test1: "origEnv",
                        test2: "origEnv",
                        test3: "origEnv",
                    },
                );
            });

            test("args from envFile should not overwrite existing variables", function () {
                assert.deepEqual(GeneralMobilePlatform.getEnvArgument(origEnv, null, envFile), {
                    test1: "origEnv",
                    test2: "origEnv",
                    test3: "origEnv",
                    test4: "envFile",
                    test5: "envFile",
                });
            });

            test("args from envFile and original args should be overwritten by env args", function () {
                assert.deepEqual(GeneralMobilePlatform.getEnvArgument(origEnv, env, envFile), {
                    test1: "origEnv",
                    test2: "env",
                    test3: "env",
                    test4: "env",
                    test5: "envFile",
                });
            });
        });

        suite("runArguments", function () {
            let mockRunArguments: any[] = [];
            const paramWithValue = "--paramWithValue";
            const binaryParam = "--binaryParam";

            suite("getOptFromRunArgs", function () {
                test("should return undefined if arguments are empty", function () {
                    const args: any[] = [];
                    assert.strictEqual(
                        GeneralMobilePlatform.getOptFromRunArgs(args, "--param1", true),
                        undefined,
                    );
                });

                test("should return correct result for binary parameters", function () {
                    const args: any[] = ["--param1", "param2"];
                    assert.strictEqual(
                        GeneralMobilePlatform.getOptFromRunArgs(args, "--param1", true),
                        true,
                    );
                    assert.strictEqual(
                        GeneralMobilePlatform.getOptFromRunArgs(args, "param2", true),
                        true,
                    );
                    assert.strictEqual(
                        GeneralMobilePlatform.getOptFromRunArgs(args, "--unknown", true),
                        undefined,
                    );
                });

                test("should return correct result for non-binary parameters", function () {
                    const args: any[] = [
                        "--param1",
                        "value1",
                        "--param2=value2",
                        "param3=value3",
                        "param4value4",
                    ];
                    assert.strictEqual(
                        GeneralMobilePlatform.getOptFromRunArgs(args, "--param1", false),
                        "value1",
                    );
                    assert.strictEqual(
                        GeneralMobilePlatform.getOptFromRunArgs(args, "--param2", false),
                        "value2",
                    );
                    assert.strictEqual(
                        GeneralMobilePlatform.getOptFromRunArgs(args, "--param1"),
                        "value1",
                    );
                    assert.strictEqual(
                        GeneralMobilePlatform.getOptFromRunArgs(args, "--param2"),
                        "value2",
                    );
                    assert.strictEqual(
                        GeneralMobilePlatform.getOptFromRunArgs(args, "param3", false),
                        "value3",
                    );
                    assert.strictEqual(
                        GeneralMobilePlatform.getOptFromRunArgs(args, "param4", false),
                        undefined,
                    );
                });
            });

            suite("removeRunArgument", function () {
                setup(() => {
                    mockRunArguments = [paramWithValue, "value", binaryParam];
                });

                test("existing binary parameter should be removed from runArguments", function () {
                    GeneralMobilePlatform.removeRunArgument(mockRunArguments, binaryParam, true);
                    assert.deepEqual(mockRunArguments, [paramWithValue, "value"]);
                });

                test("existing parameter and its value should be removed from runArguments", function () {
                    GeneralMobilePlatform.removeRunArgument(
                        mockRunArguments,
                        paramWithValue,
                        false,
                    );
                    assert.deepEqual(mockRunArguments, [binaryParam]);
                });

                test("nothing should happen if try to remove not existing parameter", function () {
                    GeneralMobilePlatform.removeRunArgument(mockRunArguments, "--undefined", false);
                    assert.deepEqual(mockRunArguments, [paramWithValue, "value", binaryParam]);
                    GeneralMobilePlatform.removeRunArgument(mockRunArguments, "--undefined", true);
                    assert.deepEqual(mockRunArguments, [paramWithValue, "value", binaryParam]);
                });
            });

            suite("setRunArgument", function () {
                setup(() => {
                    mockRunArguments = [paramWithValue, "value", binaryParam];
                });

                test("new binary parameter should be added to runArguments", function () {
                    GeneralMobilePlatform.setRunArgument(
                        mockRunArguments,
                        "--newBinaryParam",
                        true,
                    );
                    assert.deepEqual(mockRunArguments, [
                        paramWithValue,
                        "value",
                        binaryParam,
                        "--newBinaryParam",
                    ]);
                });

                test("new parameter with value and its value should be added to runArguments", function () {
                    GeneralMobilePlatform.setRunArgument(
                        mockRunArguments,
                        "--newParamWithValue",
                        "itsValue",
                    );
                    assert.deepEqual(mockRunArguments, [
                        paramWithValue,
                        "value",
                        binaryParam,
                        "--newParamWithValue",
                        "itsValue",
                    ]);
                });

                test("value of existing parameter with value should be overwritten by new value", function () {
                    GeneralMobilePlatform.setRunArgument(
                        mockRunArguments,
                        paramWithValue,
                        "newValue",
                    );
                    assert.deepEqual(mockRunArguments, [paramWithValue, "newValue", binaryParam]);
                });

                test("new binary parameter should not be added to runArguments if its value if false", function () {
                    GeneralMobilePlatform.setRunArgument(
                        mockRunArguments,
                        "--newBinaryParam",
                        false,
                    );
                    assert.deepEqual(mockRunArguments, [paramWithValue, "value", binaryParam]);
                });

                test("existing binary parameter should be removed from runArguments if its value if false", function () {
                    GeneralMobilePlatform.setRunArgument(mockRunArguments, binaryParam, false);
                    assert.deepEqual(mockRunArguments, [paramWithValue, "value"]);
                });
            });
        });
    });
});
