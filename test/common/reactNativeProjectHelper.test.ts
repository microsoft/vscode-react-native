// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ReactNativeProjectHelper } from "../../src/common/reactNativeProjectHelper";
import { Node } from "../../src/common/node/node";

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";

suite("reactNativeProjectHelper", function() {

    const sampleReactNative022ProjectDir = path.join(__dirname, "..", "resources", "sampleReactNative022Project");

    test("getReactNativeVersionFromProjectPackage should return version string if 'version' field is found in project's package.json file", (done: MochaDone) => {
        ReactNativeProjectHelper.getReactNativeVersionFromProjectPackage(sampleReactNative022ProjectDir)
        .then(version => {
            assert.equal(version, "^0.22.2");
        }).done(() => done(), done);
    });

    suite("getReactNativeVersionFromProjectWithIncorrectPackageJson", function() {

        const packageJsonPath = path.join(sampleReactNative022ProjectDir, "package.json");
        const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
        const versionObj = {
            "devDependencies": { },
        };

        suiteSetup(() => {
            fs.writeFileSync(packageJsonPath, JSON.stringify(versionObj, null, 2));
        });

        suiteTeardown(() => {
            fs.writeFileSync(packageJsonPath, packageJsonContent);
        });

        test("getReactNativeVersionFromProjectPackage should return empty string if 'version' field isn't found in project's package.json file", (done: MochaDone) => {
            ReactNativeProjectHelper.getReactNativeVersionFromProjectPackage(sampleReactNative022ProjectDir)
            .then(version => {
                assert.equal(version, "");
            }).done(() => done(), done);
        });
    });

    suite("getReactNativeVersionFromNodeModules", function () {

        const reactNativePackageDir = path.join(sampleReactNative022ProjectDir, "node_modules", "react-native");
        const fsHelper = new Node.FileSystem();

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(reactNativePackageDir);
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(path.join(sampleReactNative022ProjectDir, "node_modules"));
        });

        test("getReactNativePackageVersionFromNodeModules should return if 'version' field is found in react-native package package.json file from node_modules", (done: MochaDone) => {
            const versionObj = {
                "version": "^0.20.0",
            };

            fs.writeFileSync(path.join(reactNativePackageDir, "package.json"), JSON.stringify(versionObj, null, 2));

            ReactNativeProjectHelper.getReactNativePackageVersionFromNodeModules(sampleReactNative022ProjectDir)
            .then(version => {
                assert.equal(version, "^0.20.0");
            }).done(() => done(), done);
        });

        test("getReactNativePackageVersionFromNodeModules should return string if version field is an URL", (done: MochaDone) => {
            const versionObj = {
                "version": "https://github.com/expo/react-native/archive/sdk-35.0.0.tar.gz",
            };

            fs.writeFileSync(path.join(reactNativePackageDir, "package.json"), JSON.stringify(versionObj, null, 2));

            ReactNativeProjectHelper.getReactNativePackageVersionFromNodeModules(sampleReactNative022ProjectDir)
            .then(version => {
                assert.equal(version, "https://github.com/expo/react-native/archive/sdk-35.0.0.tar.gz");
            }).done(() => done(), done);
        });
    });

    test("getReactNativePackageVersionFromNodeModules should throw ReactNativePackageIsNotInstalled error if package is not installed", (done: MochaDone) => {
        ReactNativeProjectHelper.getReactNativePackageVersionFromNodeModules(sampleReactNative022ProjectDir)
        .catch(error => {
            assert.equal(error.errorCode, 606);
        }).done(() => done(), done);
    });
});
