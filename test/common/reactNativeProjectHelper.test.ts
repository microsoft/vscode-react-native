// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ReactNativeProjectHelper } from "../../src/common/reactNativeProjectHelper";

import { Node } from "../../src/common/node/node";

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";

suite("reactNativeProjectHelper", function() {
    suite("getReactNativeVersion", function () {

        const sampleReactNative022ProjectDir = path.join(__dirname, "..", "resources", "sampleReactNative022Project");
        const reactNativePackageDir = path.join(sampleReactNative022ProjectDir, "node_modules", "react-native");
        const fsHelper = new Node.FileSystem();

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(reactNativePackageDir);
        });

        test("getReactNativePackageVersionFromNodeModules should return if 'version' field is found in react-native package package.json file from node_modules", (done: MochaDone) => {
            let versionObj = {
                "version": "^0.20.0",
            };

            fs.writeFileSync(path.join(reactNativePackageDir, "package.json"), JSON.stringify(versionObj, null, 2));

            ReactNativeProjectHelper.getReactNativePackageVersionFromNodeModules(sampleReactNative022ProjectDir)
            .then(version => {
                assert.equal(version, "^0.20.0");
                fsHelper.removePathRecursivelySync(path.join(sampleReactNative022ProjectDir, "node_modules"));
            }).done(() => done(), done);
        });

        test("getReactNativeVersionFromProjectPackage should return version string if 'version' field is found in project's package.json file", (done: MochaDone) => {
            ReactNativeProjectHelper.getReactNativeVersionFromProjectPackage(sampleReactNative022ProjectDir)
            .then(version => {
                assert.equal(version, "^0.22.2");
            }).done(() => done(), done);
        });
    });
});
