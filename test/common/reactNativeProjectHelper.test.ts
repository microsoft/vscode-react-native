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
            assert.equal(version, "0.22.2");
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

        test("getReactNativePackageVersionFromNodeModules should return package version if 'version' field is found in react-native package package.json file from node_modules", (done: MochaDone) => {
            const versionObj = {
                "version": "^0.20.0",
            };

            fs.writeFileSync(path.join(reactNativePackageDir, "package.json"), JSON.stringify(versionObj, null, 2));

            ReactNativeProjectHelper.getReactNativePackageVersionFromNodeModules(sampleReactNative022ProjectDir)
            .then(version => {
                assert.equal(version, "0.20.0");
            }).done(() => done(), done);
        });

        test("getReactNativePackageVersionFromNodeModules should return string if version field is an URL", (done: MochaDone) => {
            const versionObj = {
                "version": "https://github.com/expo/react-native/archive/sdk-35.0.0.tar.gz",
            };

            fs.writeFileSync(path.join(reactNativePackageDir, "package.json"), JSON.stringify(versionObj, null, 2));

            ReactNativeProjectHelper.getReactNativePackageVersionFromNodeModules(sampleReactNative022ProjectDir)
            .then(version => {
                assert.equal(version, "SemverInvalid: URL");
            }).done(() => done(), done);
        });
    });

    test("getReactNativePackageVersionFromNodeModules should throw ReactNativePackageIsNotInstalled error if the package is not installed", (done: MochaDone) => {
        ReactNativeProjectHelper.getReactNativePackageVersionFromNodeModules(sampleReactNative022ProjectDir)
        .catch(error => {
            assert.equal(error.errorCode, 606);
        }).done(() => done(), done);
    });

    test("processVersion should return semver valid version strings or SemverInvalid one", (done: MochaDone) => {
        let randomString = "";
        let asciiLow = 65;
        let asciiHigh = 90;

        for (let i = 0; i < 12; i++) { // generate random string containing only letters
            randomString += String.fromCharCode(Math.floor((Math.random() * (asciiHigh - asciiLow)) + asciiLow));
        }

        assert.equal(ReactNativeProjectHelper.processVersion("0.61.0-rc.0"), "0.61.0");
        assert.equal(ReactNativeProjectHelper.processVersion("0.61.3"), "0.61.3");
        assert.equal(ReactNativeProjectHelper.processVersion("https://github.com/expo/react-native/archive/sdk-35.0.0.tar.gz"), "SemverInvalid: URL");
        assert.equal(ReactNativeProjectHelper.processVersion(randomString), "SemverInvalid");
        assert.equal(ReactNativeProjectHelper.processVersion("^0.61.2.0"), "0.61.2");
        assert.equal(ReactNativeProjectHelper.processVersion("^str.0.61.str.2"), "0.61.0");
        assert.equal(ReactNativeProjectHelper.processVersion(""), "SemverInvalid");

        done();
    });
});
