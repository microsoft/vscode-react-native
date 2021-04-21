// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ProjectVersionHelper } from "../../src/common/projectVersionHelper";
import { RN_VERSION_ERRORS } from "../../src/common/error/versionError";
import { Node } from "../../src/common/node/node";

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import { ParsedPackage } from "../../src/common/reactNativeProjectHelper";
import { AppLauncher } from "../../src/extension/appLauncher";

suite("projectVersionHelper", function () {
    const sampleReactNative022ProjectDir = path.join(
        __dirname,
        "..",
        "resources",
        "sampleReactNative022Project",
    );

    const nodeModulesRoot: string = AppLauncher.getNodeModulesRootByProjectPath(
        sampleReactNative022ProjectDir,
    );

    test("getReactNativeVersionsFromProjectPackage should return object containing version strings if 'version' field is found in project's package.json file", () => {
        let additionalPackages: ParsedPackage[] = [];
        additionalPackages.push({
            packageName: "react-native-windows",
            useSemverCoerce: false,
        });
        return ProjectVersionHelper.getReactNativeVersionsFromProjectPackage(
            sampleReactNative022ProjectDir,
            additionalPackages,
        ).then(versions => {
            assert.strictEqual(versions.reactNativeVersion, "0.22.2");
            assert.strictEqual(versions.reactNativeWindowsVersion, "0.60.0-vnext.68");
        });
    });

    suite("getReactNativeVersionsFromProjectWithIncorrectPackageJson", () => {
        const packageJsonPath = path.join(sampleReactNative022ProjectDir, "package.json");
        const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
        const versionObj = {
            devDependencies: {},
        };

        suiteSetup(() => {
            fs.writeFileSync(packageJsonPath, JSON.stringify(versionObj, null, 2));
        });

        suiteTeardown(() => {
            fs.writeFileSync(packageJsonPath, packageJsonContent);
        });

        test("getReactNativeVersionsFromProjectPackage should return containing empty version strings if 'version' field isn't found in project's package.json file", () => {
            let additionalPackages: ParsedPackage[] = [];
            additionalPackages.push({
                packageName: "react-native-windows",
                useSemverCoerce: false,
            });
            return ProjectVersionHelper.getReactNativeVersionsFromProjectPackage(
                sampleReactNative022ProjectDir,
                additionalPackages,
            ).then(versions => {
                assert.strictEqual(
                    versions.reactNativeVersion,
                    "errorMissingDependenciesFieldsInProjectPackageFile",
                );
                assert.strictEqual(
                    versions.reactNativeWindowsVersion,
                    "errorMissingDependenciesFieldsInProjectPackageFile",
                );
            });
        });
    });

    suite("getReactNativeVersionsFromNodeModules", () => {
        const reactNativePackageDir = path.join(
            sampleReactNative022ProjectDir,
            "node_modules",
            "react-native",
        );
        const reactNativeWindowsPackageDir = path.join(
            sampleReactNative022ProjectDir,
            "node_modules",
            "react-native-windows",
        );
        const fsHelper = new Node.FileSystem();

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(reactNativePackageDir);
            fsHelper.makeDirectoryRecursiveSync(reactNativeWindowsPackageDir);
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(
                path.join(sampleReactNative022ProjectDir, "node_modules"),
            );
        });

        test("getReactNativePackageVersionsFromNodeModules should return object containing packages versions if 'version' field is found in react-native and react-native-windows packages package.json files from node_modules", (done: Mocha.Done) => {
            const reactNativeVersionObj = {
                version: "^0.20.0",
            };

            const reactNativeWindowsVersionObj = {
                version: "^0.60.0-vnext.68",
            };

            fs.writeFileSync(
                path.join(reactNativePackageDir, "package.json"),
                JSON.stringify(reactNativeVersionObj, null, 2),
            );
            fs.writeFileSync(
                path.join(reactNativeWindowsPackageDir, "package.json"),
                JSON.stringify(reactNativeWindowsVersionObj, null, 2),
            );

            let additionalPackages: ParsedPackage[] = [];
            additionalPackages.push({
                packageName: "react-native-windows",
                useSemverCoerce: false,
            });
            ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
                nodeModulesRoot,
                additionalPackages,
            ).then(versions => {
                assert.strictEqual(versions.reactNativeVersion, "0.20.0");
                assert.strictEqual(versions.reactNativeWindowsVersion, "0.60.0-vnext.68");
                done();
            });
        });

        test("getReactNativePackageVersionsFromNodeModules should return object containing strings if version field is an URL", () => {
            const versionObj = {
                version: "https://github.com/expo/react-native/archive/sdk-35.0.0.tar.gz",
            };

            fs.writeFileSync(
                path.join(reactNativePackageDir, "package.json"),
                JSON.stringify(versionObj, null, 2),
            );

            return ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
                nodeModulesRoot,
            ).then(versions => {
                assert.strictEqual(versions.reactNativeVersion, "SemverInvalid: URL");
            });
        });
    });

    test("getReactNativePackageVersionsFromNodeModules should throw ReactNativePackageIsNotInstalled error if the package is not installed", () => {
        return ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
            nodeModulesRoot,
        ).catch(error => {
            assert.strictEqual(error.errorCode, 606);
        });
    });

    test("isVersionError should return true if a version string contains an error substring", (done: Mocha.Done) => {
        assert.strictEqual(
            ProjectVersionHelper.isVersionError(
                RN_VERSION_ERRORS.MISSING_DEPENDENCIES_FIELDS_IN_PROJECT_PACKAGE_FILE,
            ),
            true,
        );
        assert.strictEqual(
            ProjectVersionHelper.isVersionError(RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES),
            true,
        );
        assert.strictEqual(
            ProjectVersionHelper.isVersionError(
                RN_VERSION_ERRORS.MISSING_DEPENDENCY_IN_PROJECT_PACKAGE_FILE,
            ),
            true,
        );
        assert.strictEqual(
            ProjectVersionHelper.isVersionError(RN_VERSION_ERRORS.UNKNOWN_ERROR),
            true,
        );
        assert.strictEqual(ProjectVersionHelper.isVersionError("someError"), true);
        assert.strictEqual(ProjectVersionHelper.isVersionError("ERRORSTRING"), true);

        done();
    });

    test("isVersionError should return false if a version string doesn't contain an error substring", (done: Mocha.Done) => {
        assert.strictEqual(ProjectVersionHelper.isVersionError("^0.60.0-vnext.68"), false);
        assert.strictEqual(
            ProjectVersionHelper.isVersionError(
                "https://github.com/expo/react-native/archive/sdk-35.0.0.tar.gz",
            ),
            false,
        );
        assert.strictEqual(ProjectVersionHelper.isVersionError("SemverInvalid"), false);
        assert.strictEqual(ProjectVersionHelper.isVersionError("0.61.0"), false);
        assert.strictEqual(ProjectVersionHelper.isVersionError("SemverInvalid: URL"), false);
        assert.strictEqual(ProjectVersionHelper.isVersionError("*"), false);

        done();
    });

    test("processVersion should return semver valid version strings or correct error strings", (done: Mocha.Done) => {
        assert.strictEqual(
            ProjectVersionHelper.processVersion("^0.60.0-vnext.68", false),
            "0.60.0-vnext.68",
        );
        assert.strictEqual(
            ProjectVersionHelper.processVersion("=v0.60.0-vnext.68", false),
            "0.60.0-vnext.68",
        );
        assert.strictEqual(
            ProjectVersionHelper.processVersion("1.0.0 - 2.9999.9999", false),
            "SemverInvalid",
        );
        assert.strictEqual(ProjectVersionHelper.processVersion("latest", false), "SemverInvalid");
        assert.strictEqual(ProjectVersionHelper.processVersion("~1.2", false), "SemverInvalid");
        assert.strictEqual(ProjectVersionHelper.processVersion("2.x", false), "SemverInvalid");
        assert.strictEqual(ProjectVersionHelper.processVersion(">=1.0.2", false), "1.0.2");
        assert.strictEqual(ProjectVersionHelper.processVersion("<3.0.0", false), "3.0.0");

        assert.strictEqual(ProjectVersionHelper.processVersion("0.61.0-rc.0"), "0.61.0");
        assert.strictEqual(ProjectVersionHelper.processVersion("~1.2.3-beta.1"), "1.2.3");
        assert.strictEqual(ProjectVersionHelper.processVersion("~0.61.3-dev"), "0.61.3");
        assert.strictEqual(ProjectVersionHelper.processVersion("v0.61.3-dev"), "0.61.3");
        assert.strictEqual(ProjectVersionHelper.processVersion("^0.61.2.0"), "0.61.2");
        assert.strictEqual(ProjectVersionHelper.processVersion("0.61.3"), "0.61.3");

        assert.strictEqual(
            ProjectVersionHelper.processVersion(
                "https://github.com/expo/react-native/archive/sdk-35.0.0.tar.gz",
            ),
            "SemverInvalid: URL",
        );
        assert.strictEqual(
            ProjectVersionHelper.processVersion(
                "/github.com/expo/react-native/archive/sdk-35.0.0.tar.gz",
            ),
            "35.0.0",
        );
        assert.strictEqual(
            ProjectVersionHelper.processVersion("git+https://git@github.com/test/test.git"),
            "SemverInvalid: URL",
        );
        assert.strictEqual(
            ProjectVersionHelper.processVersion("/github.com/expo/react-native/archive/sdk"),
            "SemverInvalid",
        );
        assert.strictEqual(
            ProjectVersionHelper.processVersion("qwertyuiop[]asdfghjk"),
            "SemverInvalid",
        );
        assert.strictEqual(
            ProjectVersionHelper.processVersion("/Users/test/Data"),
            "SemverInvalid",
        );
        assert.strictEqual(
            ProjectVersionHelper.processVersion("@#.str?/4568-7468/.fd"),
            "4568.0.0",
        );
        assert.strictEqual(ProjectVersionHelper.processVersion("^str.0.61.str.2"), "0.61.0");
        assert.strictEqual(ProjectVersionHelper.processVersion("qwert  1 asdf"), "1.0.0");
        assert.strictEqual(ProjectVersionHelper.processVersion("^0.str.str.2"), "0.0.0");
        assert.strictEqual(ProjectVersionHelper.processVersion(""), "SemverInvalid");

        assert.strictEqual(ProjectVersionHelper.processVersion("1.0.x"), "1.0.0");
        assert.strictEqual(ProjectVersionHelper.processVersion("*.0.*"), "0.0.0");
        assert.strictEqual(ProjectVersionHelper.processVersion("~1.*"), "1.0.0");
        assert.strictEqual(ProjectVersionHelper.processVersion("1.0"), "1.0.0");
        assert.strictEqual(ProjectVersionHelper.processVersion("~1"), "1.0.0");
        assert.strictEqual(ProjectVersionHelper.processVersion("*"), "SemverInvalid");

        done();
    });
});
