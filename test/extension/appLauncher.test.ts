// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { AppLauncher } from "../../src/extension/appLauncher";
import { ProjectsStorage } from "../../src/extension/projectsStorage";
import { activate, deactivate } from "../../src/extension/rn-extension";
import { Node } from "../../src/common/node/node";
suite("appLauncher", function () {
    const fsHelper = new Node.FileSystem();

    const SAMPLE_PROJECT_NAME: string = "sampleProjectForAppLauncherTest";
    const sampleReactNativeProjectDir = path.join(
        __dirname,
        "..",
        "resources",
        SAMPLE_PROJECT_NAME,
    );

    const NODE_MODULES_FOLDER: string = "node_modules";
    const REACT_NATIVE_MODULE: string = "react-native";
    const INFORMATION_PACKAGE_FILENAME: string = "package.json";

    const versionObj = {
        dependencies: {
            "react-native": "^0.22.2",
        },
    };

    suiteSetup(() => {
        fsHelper.makeDirectoryRecursiveSync(sampleReactNativeProjectDir);
        fs.writeFileSync(
            path.join(sampleReactNativeProjectDir, INFORMATION_PACKAGE_FILENAME),
            JSON.stringify(versionObj, null, 2),
        );
    });

    suiteTeardown(() => {
        fsHelper.removePathRecursivelySync(sampleReactNativeProjectDir);
    });

    suite("getOrCreateAppLauncherByProjectRootPath", function () {
        test("getOrCreateAppLauncherByProjectRootPath creates an AppLauncher", async function () {
            let isAppLauncherExist: boolean =
                !!ProjectsStorage.projectsCache[sampleReactNativeProjectDir.toLowerCase()];

            let appLauncherTest: AppLauncher;

            teardown(() => {
                if (appLauncherTest) {
                    ProjectsStorage.delFolder(appLauncherTest.getWorkspaceFolder());
                }
                deactivate();
            });

            assert.strictEqual(isAppLauncherExist, false);

            activate(<vscode.ExtensionContext>{
                subscriptions: [{}],
            });

            const appLauncher = await AppLauncher.getOrCreateAppLauncherByProjectRootPath(
                sampleReactNativeProjectDir,
            );
            appLauncherTest = appLauncher;
            assert.strictEqual(
                appLauncher.getPackager().getProjectPath(),
                sampleReactNativeProjectDir,
            );
            isAppLauncherExist =
                !!ProjectsStorage.projectsCache[sampleReactNativeProjectDir.toLowerCase()];
            assert.strictEqual(isAppLauncherExist, true);
        });
    });

    suite("getOrUpdateNodeModulesRoot", function () {
        test("getOrUpdateNodeModulesRoot gets a node modules root", async function () {
            const reactNativePackageDir: string = path.join(
                sampleReactNativeProjectDir,
                NODE_MODULES_FOLDER,
                REACT_NATIVE_MODULE,
            );
            fsHelper.makeDirectoryRecursiveSync(reactNativePackageDir);

            let appLauncherTest: AppLauncher;

            teardown(() => {
                fsHelper.removePathRecursivelySync(
                    path.join(sampleReactNativeProjectDir, NODE_MODULES_FOLDER),
                );

                if (appLauncherTest) {
                    ProjectsStorage.delFolder(appLauncherTest.getWorkspaceFolder());
                }
                deactivate();
            });

            activate(<vscode.ExtensionContext>{
                subscriptions: [{}],
            });

            const appLauncher = await AppLauncher.getOrCreateAppLauncherByProjectRootPath(
                sampleReactNativeProjectDir,
            );
            appLauncherTest = appLauncher;
            assert.strictEqual(
                appLauncher.getOrUpdateNodeModulesRoot(),
                sampleReactNativeProjectDir,
            );
        });

        test("getOrUpdateNodeModulesRoot force updates a node modules root", async function () {
            const SAMPLE_TEST_PROJECT_NAME: string = "sampleGetOrUpdateNodeModulesRootProject";
            const sampleTestProjectDir = path.join(
                __dirname,
                "..",
                "resources",
                SAMPLE_TEST_PROJECT_NAME,
            );

            const reactNativePackageDir1: string = path.join(
                sampleTestProjectDir,
                NODE_MODULES_FOLDER,
                REACT_NATIVE_MODULE,
            );

            const INNER_FOLDER: string = "inner";
            const innerProjectDir: string = path.join(sampleTestProjectDir, INNER_FOLDER);
            const reactNativePackageDir2: string = path.join(
                innerProjectDir,
                NODE_MODULES_FOLDER,
                REACT_NATIVE_MODULE,
            );

            let appLauncherTest: AppLauncher;
            let nodeModulesRoot1: string;
            let nodeModulesRoot2: string;

            fsHelper.makeDirectoryRecursiveSync(reactNativePackageDir2);

            fs.writeFileSync(
                path.join(innerProjectDir, INFORMATION_PACKAGE_FILENAME),
                JSON.stringify(versionObj, null, 2),
            );

            teardown(() => {
                fsHelper.removePathRecursivelySync(sampleTestProjectDir);
                if (appLauncherTest) {
                    ProjectsStorage.delFolder(appLauncherTest.getWorkspaceFolder());
                }
            });

            activate(<vscode.ExtensionContext>{
                subscriptions: [{}],
            });

            const appLauncher = await AppLauncher.getOrCreateAppLauncherByProjectRootPath(
                innerProjectDir,
            );
            nodeModulesRoot1 = appLauncher.getOrUpdateNodeModulesRoot();
            assert.deepStrictEqual(nodeModulesRoot1, innerProjectDir);
            fsHelper.removePathRecursivelySync(innerProjectDir);
            appLauncherTest = appLauncher;
            fsHelper.makeDirectoryRecursiveSync(reactNativePackageDir1);
            fs.writeFileSync(
                path.join(sampleTestProjectDir, INFORMATION_PACKAGE_FILENAME),
                JSON.stringify(versionObj, null, 2),
            );
            nodeModulesRoot2 = appLauncher.getOrUpdateNodeModulesRoot(true);
            assert.deepStrictEqual(nodeModulesRoot2, sampleTestProjectDir);
            assert.notStrictEqual(nodeModulesRoot1, nodeModulesRoot2);
        });
    });
});
