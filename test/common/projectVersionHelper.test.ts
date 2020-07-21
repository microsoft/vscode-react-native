// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ProjectVersionHelper } from "../../src/common/projectVersionHelper";
import { RN_VERSION_ERRORS } from "../../src/common/error/versionError";
import { Node } from "../../src/common/node/node";

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";

suite("projectVersionHelper", function() {

    const sampleReactNative022ProjectDir = path.join(__dirname, "..", "resources", "sampleReactNative022Project");

    test("getReactNativeVersionsFromProjectPackage should return object containing version strings if 'version' field is found in project's package.json file", () => {
        return ProjectVersionHelper.getReactNativeVersionsFromProjectPackage(sampleReactNative022ProjectDir, true)
        .then(versions => {
            assert.equal(versions.reactNativeVersion, "0.22.2");
            assert.equal(versions.reactNativeWindowsVersion, "0.60.0-vnext.68");
        });
    });

    suite("getReactNativeVersionsFromProjectWithIncorrectPackageJson", () => {

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

        test("getReactNativeVersionsFromProjectPackage should return containing empty version strings if 'version' field isn't found in project's package.json file", () => {
            return ProjectVersionHelper.getReactNativeVersionsFromProjectPackage(sampleReactNative022ProjectDir, true)
            .then(versions => {
                assert.equal(versions.reactNativeVersion, "errorMissingDependenciesFieldsInProjectPackageFile");
                assert.equal(versions.reactNativeWindowsVersion, "errorMissingDependenciesFieldsInProjectPackageFile");
            });
        });
    });

    suite("getReactNativeVersionsFromNodeModules", () => {

        const reactNativePackageDir = path.join(sampleReactNative022ProjectDir, "node_modules", "react-native");
        const reactNativeWindowsPackageDir = path.join(sampleReactNative022ProjectDir, "node_modules", "react-native-windows");
        const fsHelper = new Node.FileSystem();

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(reactNativePackageDir);
            fsHelper.makeDirectoryRecursiveSync(reactNativeWindowsPackageDir);
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(path.join(sampleReactNative022ProjectDir, "node_modules"));
        });

        test("getReactNativePackageVersionsFromNodeModules should return object containing packages versions if 'version' field is found in react-native and react-native-windows packages package.json files from node_modules", (done: MochaDone) => {
            const reactNativeVersionObj = {
                "version": "^0.20.0",
            };

            const reactNativeWindowsVersionObj = {
                "version": "^0.60.0-vnext.68",
            };

            fs.writeFileSync(path.join(reactNativePackageDir, "package.json"), JSON.stringify(reactNativeVersionObj, null, 2));
            fs.writeFileSync(path.join(reactNativeWindowsPackageDir, "package.json"), JSON.stringify(reactNativeWindowsVersionObj, null, 2));

            ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(sampleReactNative022ProjectDir, true)
            .then(versions => {
                assert.equal(versions.reactNativeVersion, "0.20.0");
                assert.equal(versions.reactNativeWindowsVersion, "0.60.0-vnext.68");
                done();
            });
        });

        test("getReactNativePackageVersionsFromNodeModules should return object containing strings if version field is an URL", () => {
            const versionObj = {
                "version": "https://github.com/expo/react-native/archive/sdk-35.0.0.tar.gz",
            };

            fs.writeFileSync(path.join(reactNativePackageDir, "package.json"), JSON.stringify(versionObj, null, 2));

            return ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(sampleReactNative022ProjectDir)
            .then(versions => {
                assert.equal(versions.reactNativeVersion, "SemverInvalid: URL");
            });
        });
    });

    test("getReactNativePackageVersionsFromNodeModules should throw ReactNativePackageIsNotInstalled error if the package is not installed", () => {
        return ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(sampleReactNative022ProjectDir)
        .catch(error => {
            assert.equal(error.errorCode, 606);
        });
    });

    test("isVersionError should return true if a version string contains an error substring", (done: MochaDone) => {
        assert.equal(ProjectVersionHelper.isVersionError(RN_VERSION_ERRORS.MISSING_DEPENDENCIES_FIELDS_IN_PROJECT_PACKAGE_FILE), true);
        assert.equal(ProjectVersionHelper.isVersionError(RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES), true);
        assert.equal(ProjectVersionHelper.isVersionError(RN_VERSION_ERRORS.MISSING_DEPENDENCY_IN_PROJECT_PACKAGE_FILE), true);
        assert.equal(ProjectVersionHelper.isVersionError(RN_VERSION_ERRORS.UNKNOWN_ERROR), true);
        assert.equal(ProjectVersionHelper.isVersionError("someError"), true);
        assert.equal(ProjectVersionHelper.isVersionError("ERRORSTRING"), true);

        done();
    });

    test("isVersionError should return false if a version string doesn't contain an error substring", (done: MochaDone) => {
        assert.equal(ProjectVersionHelper.isVersionError("^0.60.0-vnext.68"), false);
        assert.equal(ProjectVersionHelper.isVersionError("https://github.com/expo/react-native/archive/sdk-35.0.0.tar.gz"), false);
        assert.equal(ProjectVersionHelper.isVersionError("SemverInvalid"), false);
        assert.equal(ProjectVersionHelper.isVersionError("0.61.0"), false);
        assert.equal(ProjectVersionHelper.isVersionError("SemverInvalid: URL"), false);
        assert.equal(ProjectVersionHelper.isVersionError("*"), false);

        done();
    });

    test("processVersion should return semver valid version strings or correct error strings", (done: MochaDone) => {

        assert.equal(ProjectVersionHelper.processVersion("^0.60.0-vnext.68", false), "0.60.0-vnext.68");
        assert.equal(ProjectVersionHelper.processVersion("=v0.60.0-vnext.68", false), "0.60.0-vnext.68");
        assert.equal(ProjectVersionHelper.processVersion("1.0.0 - 2.9999.9999", false), "SemverInvalid");
        assert.equal(ProjectVersionHelper.processVersion("latest", false), "SemverInvalid");
        assert.equal(ProjectVersionHelper.processVersion("~1.2", false), "SemverInvalid");
        assert.equal(ProjectVersionHelper.processVersion("2.x", false), "SemverInvalid");
        assert.equal(ProjectVersionHelper.processVersion(">=1.0.2", false), "1.0.2");
        assert.equal(ProjectVersionHelper.processVersion("<3.0.0", false), "3.0.0");

        assert.equal(ProjectVersionHelper.processVersion("0.61.0-rc.0"), "0.61.0");
        assert.equal(ProjectVersionHelper.processVersion("~1.2.3-beta.1"), "1.2.3");
        assert.equal(ProjectVersionHelper.processVersion("~0.61.3-dev"), "0.61.3");
        assert.equal(ProjectVersionHelper.processVersion("v0.61.3-dev"), "0.61.3");
        assert.equal(ProjectVersionHelper.processVersion("^0.61.2.0"), "0.61.2");
        assert.equal(ProjectVersionHelper.processVersion("0.61.3"), "0.61.3");

        assert.equal(ProjectVersionHelper.processVersion("https://github.com/expo/react-native/archive/sdk-35.0.0.tar.gz"), "SemverInvalid: URL");
        assert.equal(ProjectVersionHelper.processVersion("/github.com/expo/react-native/archive/sdk-35.0.0.tar.gz"), "35.0.0");
        assert.equal(ProjectVersionHelper.processVersion("git+https://git@github.com/test/test.git"), "SemverInvalid: URL");
        assert.equal(ProjectVersionHelper.processVersion("/github.com/expo/react-native/archive/sdk"), "SemverInvalid");
        assert.equal(ProjectVersionHelper.processVersion("qwertyuiop[]asdfghjk"), "SemverInvalid");
        assert.equal(ProjectVersionHelper.processVersion("/Users/test/Data"), "SemverInvalid");
        assert.equal(ProjectVersionHelper.processVersion("@#.str?/4568-7468/.fd"), "4568.0.0");
        assert.equal(ProjectVersionHelper.processVersion("^str.0.61.str.2"), "0.61.0");
        assert.equal(ProjectVersionHelper.processVersion("qwert  1 asdf"), "1.0.0");
        assert.equal(ProjectVersionHelper.processVersion("^0.str.str.2"), "0.0.0");
        assert.equal(ProjectVersionHelper.processVersion(""), "SemverInvalid");

        assert.equal(ProjectVersionHelper.processVersion("1.0.x"), "1.0.0");
        assert.equal(ProjectVersionHelper.processVersion("*.0.*"), "0.0.0");
        assert.equal(ProjectVersionHelper.processVersion("~1.*"), "1.0.0");
        assert.equal(ProjectVersionHelper.processVersion("1.0"), "1.0.0");
        assert.equal(ProjectVersionHelper.processVersion("~1"), "1.0.0");
        assert.equal(ProjectVersionHelper.processVersion("*"), "SemverInvalid");

        done();
    });
});
