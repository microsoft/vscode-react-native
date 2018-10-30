// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as sinon from "sinon";

import { IOSPlatform } from "../../../src/extension/ios/iOSPlatform";

import "should";
import { SettingsHelper } from "../../../src/extension/settingsHelper";

suite("iOSPlatform", function () {
    const projectRoot = "/User/test/react-native/AwesomeProject";
    let runOptions: any = {
        platform: "ios",
        workspaceRoot: "/User/test/react-native/AwesomeProject",
        projectRoot: projectRoot,
    };

    const sandbox = sinon.sandbox.create();

    setup(() => {
        sandbox.stub(SettingsHelper, "getReactNativeProjectRoot", () => projectRoot);
    });

    teardown(() => {
        runOptions = {
            platform: "ios",
            workspaceRoot: "/User/test/react-native/AwesomeProject",
            projectRoot: "/User/test/react-native/AwesomeProject",
        };
        sandbox.restore();
    });

    suite("extensionContext", function () {
        test("getRunArgument properties not defined", function () {
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.runArguments, []);
        });
        test("getRunArgument simulator simulator", function () {
            runOptions.target = "simulator";
            const expected = ["--simulator"];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.runArguments, expected);
        });
        test("getRunArgument device device", function () {
            runOptions.target = "device";
            const expected = ["--device"];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.runArguments, expected);
        });
        test("getRunArgument simulator iPhone 6", function () {
            runOptions.target = "iPhone 6";
            const expected = ["--simulator", runOptions.target];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.runArguments, expected);
        });
    });
});
