// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";

import { IOSPlatform } from "../../../src/extension/ios/iOSPlatform";
// import { IRunOptions } from "../../../src/common/launchArgs";

import "should";

suite("iOSPlatform", function () {
    let runOptions: any = {
        platform: "ios",
        projectRoot: "/User/test/react-native/AwesomeProject",
    };

    teardown(() => {
        runOptions = {
            platform: "ios",
            projectRoot: "/User/test/react-native/AwesomeProject",
        };
    });

    suite("extensionContext", function () {
        test("getRunArgument properties not defined", function () {
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.getRunArgument(), []);
        });
        test("getRunArgument simulator simulator", function () {
            runOptions.target = "simulator";
            const expected = ["--simulator"];
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
    });
});
