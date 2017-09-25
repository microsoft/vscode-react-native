// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";

import { IOSPlatform } from "../../../src/extension/ios/iOSPlatform";

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
            assert.deepEqual(platform.getRunArgument(), ["--no-packager"]);
        });
        test("getRunArgument simulator simulator", function () {
            runOptions.target = "simulator";
            const expected = ["--simulator", "--no-packager"];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.getRunArgument(), expected);
        });
        test("getRunArgument device device", function () {
            runOptions.target = "device";
            const expected = ["--device", "--no-packager"];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.getRunArgument(), expected);
        });
        test("getRunArgument simulator iPhone 6", function () {
            runOptions.target = "iPhone 6";
            const expected = ["--simulator", runOptions.target, "--no-packager"];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.getRunArgument(), expected);
        });
    });
});
