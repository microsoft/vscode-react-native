// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as sinon from "sinon";

import { IOSPlatform } from "../../../src/extension/ios/iOSPlatform";

import "should";
import { SettingsHelper } from "../../../src/extension/settingsHelper";
import { PlatformType } from "../../../src/extension/launchArgs";

suite("iOSPlatform", function () {
    const workspaceRoot: string = "/User/test/react-native/AwesomeProject";
    const projectRoot = "/User/test/react-native/AwesomeProject";
    const nodeModulesRoot: string = projectRoot;

    let runOptions: any = {
        platform: PlatformType.iOS,
        workspaceRoot,
        projectRoot,
        nodeModulesRoot,
    };

    let getReactNativeProjectRootStub: Sinon.SinonStub;

    setup(() => {
        getReactNativeProjectRootStub = sinon.stub(
            SettingsHelper,
            "getReactNativeProjectRoot",
            () => projectRoot,
        );
    });

    teardown(() => {
        runOptions = {
            platform: PlatformType.iOS,
            workspaceRoot,
            projectRoot,
            nodeModulesRoot,
        };
        getReactNativeProjectRootStub.restore();
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
        test("getRunArgument target device id", function () {
            runOptions.target = "925E6E38-0D7B-45E9-ADE0-89C20779D467";
            const expected = ["--udid", runOptions.target];
            let platform = new IOSPlatform(runOptions);
            assert.deepEqual(platform.runArguments, expected);
        });
    });
});
