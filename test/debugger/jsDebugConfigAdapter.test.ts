// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import { JsDebugConfigAdapter } from "../../src/debugger/jsDebugConfigAdapter";
import { RNPackageVersions } from "../../src/common/projectVersionHelper";

suite("jsDebugConfigAdapter", function () {
    suite("sourceMapOverrideConfiguration", function () {
        test("should get launch arguments correctly when user have both extra arguments and existing arguments", async () => {
            const version: RNPackageVersions = {
                reactNativeVersion: "0.80.0",
                reactNativeWindowsVersion: "",
                reactNativeMacOSVersion: "",
            };
            const projectPath = path.resolve(
                __dirname,
                "..",
                "resources",
                "sampleReactNativeProject",
            );
            const attachArgs = {
                cwd: projectPath,
                port: 8081,
                sourceMapPathOverrides: { testPath: "testNativePath" },
                useHermesEngine: true,
                webkitRangeMax: 9322,
                webkitRangeMin: 9223,
                reactNativeVersions: version,
                platform: "android",
                workspaceRoot: projectPath,
                projectRoot: projectPath,
                nodeModulesRoot: `${projectPath}/node_modules`,
                type: "reactnativedirect",
                name: "Test attach",
                request: "launch",
            };
            const attachConfiguration = await JsDebugConfigAdapter.createDebuggingConfigForRNHermes(
                attachArgs,
                8000,
                "",
            );
            const expected = {
                "/[metro-project]/*": `${projectPath}/*`,
                testPath: "testNativePath",
            };
            assert.deepStrictEqual(attachConfiguration.sourceMapPathOverrides, expected);
        });
    });
});
