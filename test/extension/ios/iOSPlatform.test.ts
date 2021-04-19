// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as sinon from "sinon";

import { IOSPlatform } from "../../../src/extension/ios/iOSPlatform";

import "should";
import { SettingsHelper } from "../../../src/extension/settingsHelper";
import { PlatformType } from "../../../src/extension/launchArgs";
import { AppLauncher } from "../../../src/extension/appLauncher";

suite("iOSPlatform", function () {
    const projectRoot = "/User/test/react-native/AwesomeProject";
    let runOptions: any = {
        platform: PlatformType.iOS,
        workspaceRoot: "/User/test/react-native/AwesomeProject",
        projectRoot: projectRoot,
    };

    const sandbox = sinon.sandbox.create();

    setup(() => {
        sandbox.stub(SettingsHelper, "getReactNativeProjectRoot", () => projectRoot);
    });

    teardown(() => {
        runOptions = {
            platform: PlatformType.iOS,
            workspaceRoot: "/User/test/react-native/AwesomeProject",
            projectRoot: "/User/test/react-native/AwesomeProject",
        };
        sandbox.restore();
    });

    suite("extensionContext", function () {
        const nodeModulesRoot: string = AppLauncher.getNodeModulesRoot(projectRoot);

        test("getRunArgument properties not defined", function () {
            let platform = new IOSPlatform(runOptions, undefined, nodeModulesRoot);
            assert.deepEqual(platform.runArguments, []);
        });
        test("getRunArgument simulator simulator", function () {
            runOptions.target = "simulator";
            const expected = ["--simulator"];
            let platform = new IOSPlatform(runOptions, undefined, nodeModulesRoot);
            assert.deepEqual(platform.runArguments, expected);
        });
        test("getRunArgument device device", function () {
            runOptions.target = "device";
            const expected = ["--device"];
            let platform = new IOSPlatform(runOptions, undefined, nodeModulesRoot);
            assert.deepEqual(platform.runArguments, expected);
        });
        test("getRunArgument simulator iPhone 6", function () {
            runOptions.target = "iPhone 6";
            const expected = ["--simulator", runOptions.target];
            let platform = new IOSPlatform(runOptions, undefined, nodeModulesRoot);
            assert.deepEqual(platform.runArguments, expected);
        });
        test("getRunArgument device Contoso iPhone", function () {
            runOptions.target = "device=Contoso iPhone";
            const expected = ["--device", "Contoso iPhone"];
            let platform = new IOSPlatform(runOptions, undefined, nodeModulesRoot);
            assert.deepEqual(platform.runArguments, expected);
        });
        test("getRunArgument device with incorrect 'device' field", function () {
            runOptions.target = "device Contoso iPhone";
            const expected = ["--device"];
            let platform = new IOSPlatform(runOptions, undefined, nodeModulesRoot);
            assert.deepEqual(platform.runArguments, expected);
        });
    });
});
