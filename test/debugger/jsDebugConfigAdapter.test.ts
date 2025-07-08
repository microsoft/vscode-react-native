// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { JsDebugConfigAdapter } from "../../src/debugger/jsDebugConfigAdapter";
import { RNPackageVersions } from "../../src/common/projectVersionHelper";

suite("jsDebugConfigAdapter", function () {
    suite("debuggerContext", function () {
        suite("sourceMapOverrideConfiguration", function () {
            test.only("should get launch arguments correctly when user have both extra arguments and existing arguments", async (done: Mocha.Done) => {
                const version: RNPackageVersions = {
                    reactNativeVersion: "0.80.0",
                    reactNativeWindowsVersion: "",
                    reactNativeMacOSVersion: "",
                };
                const attachArgs = {
                    cwd: "/Users/ezio/Desktop/ReactNativePackage/RepackApp",
                    port: 8081,
                    sourceMapPathOverrides: { testPath: "testNativePath" },
                    useHermesEngine: true,
                    webkitRangeMax: 9322,
                    webkitRangeMin: 9223,
                    reactNativeVersions: version,
                    platform: "android",
                    workspaceRoot: "",
                    projectRoot: "",
                    nodeModulesRoot: "",
                    type: "launch",
                    name: "Test attach",
                    request: "",
                };
                const attachConfiguration =
                    await JsDebugConfigAdapter.createDebuggingConfigForRNHermes(attachArgs, 1, "");
                console.log(attachConfiguration.sourceMapPathOverrides);
                assert.deepStrictEqual(attachConfiguration.sourceMapPathOverrides, "");
                done();
            });
        });
    });
});
