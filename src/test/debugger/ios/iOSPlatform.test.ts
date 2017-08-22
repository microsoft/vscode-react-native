// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";

import { IOSPlatform } from "../../../common/ios/iOSPlatform";
import { IRunOptions } from "../../../common/launchArgs";

import "should";

suite("iOSPlatform", function () {
    let runOptions: IRunOptions = {
        platform: "ios",
        projectRoot: "/User/test/react-native/AwesomeProject",
    };

    teardown(() => {
        runOptions = {
            platform: "ios",
            projectRoot: "/User/test/react-native/AwesomeProject",
        };
    });
    suite("#debuggerContext", function () {
        test("getRunArgument properties not defined", function () {
            const expected = ["--simulator", IOSPlatform.DEFAULT_IOS_SIMULATOR_TARGET];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.getRunArgument(), expected);
        });
        test("getRunArgument simulator simulator", function () {
            runOptions.target = "simulator";
            const expected = ["--simulator", IOSPlatform.DEFAULT_IOS_SIMULATOR_TARGET];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.getRunArgument(), expected);
        });
        test("getRunArgument device device", function () {
            runOptions.target = "device";
            const expected = ["--device"];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.getRunArgument(), expected);
        });
        test("getRunArgument simulator iPhone 6", function () {
            runOptions.target = "iPhone 6";
            const expected = ["--simulator", runOptions.target];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.getRunArgument(), expected);
        });
        test("getRunArgument simulator iPhone 7", function () {
            runOptions.target = "iPhone 7";
            runOptions.targetType = "simulator";
            const expected = [`--${runOptions.targetType}`, runOptions.target];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.getRunArgument(), expected);
        });
        test("getRunArgument device Max's iPad", function () {
            runOptions.target = "Max's iPad";
            runOptions.targetType = "device";
            const expected = [`--${runOptions.targetType}`, runOptions.target];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.getRunArgument(), expected);
        });
        test("getRunArgument default device", function () {
            runOptions.targetType = "device";
            const expected = ["--device"];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.getRunArgument(), expected);
        });
    });
});