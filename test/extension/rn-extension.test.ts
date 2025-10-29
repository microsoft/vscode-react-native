// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import { Node } from "../../src/common/node/node";
import {
    createAdditionalWorkspaceFolder,
    getCountOfWorkspaceFolders,
} from "../../src/extension/rn-extension";
suite("rn-extension", function () {
    suite("createAdditionalWorkspaceFolder", function () {
        test("createAdditionalWorkspaceFolder returns null", function () {
            const folderPath: string = "folderPath";
            const result: vscode.WorkspaceFolder | null =
                createAdditionalWorkspaceFolder(folderPath);
            assert.strictEqual(result, null);
        });

        suite("createAdditionalWorkspaceFolder returns a new workspace folder", function () {
            const fsHelper = new Node.FileSystem();
            const nodeModulesFolderName: string = "node_modules";
            const sampleReactNativeProjectDir = path.join(
                __dirname,
                "..",
                "resources",
                "sampleReactNativeProject",
            );
            const nodeModulesDir: string = path.join(
                sampleReactNativeProjectDir,
                nodeModulesFolderName,
            );

            suiteSetup(() => {
                fsHelper.makeDirectoryRecursiveSync(nodeModulesDir);
            });

            suiteTeardown(() => {
                fsHelper.removePathRecursivelySync(
                    path.join(sampleReactNativeProjectDir, nodeModulesFolderName),
                );
            });

            test("createAdditionalWorkspaceFolder should create a worspace folder, return the created folder with index increaed by 1", function () {
                const currentCountOfWorkspaceFolders: number = getCountOfWorkspaceFolders();

                const result: vscode.WorkspaceFolder | null =
                    createAdditionalWorkspaceFolder(nodeModulesDir);

                const expectedURI = vscode.Uri.file(nodeModulesDir);
                const expectedIndex: number = currentCountOfWorkspaceFolders + 1;

                const expectedResult: vscode.WorkspaceFolder = {
                    uri: expectedURI,
                    name: nodeModulesFolderName,
                    index: expectedIndex,
                };

                assert.deepStrictEqual(result, expectedResult);
            });

            test("createAdditionalWorkspaceFolder is used more than once, should create new worspace folders, return the last folder with increased index", function () {
                const currentCountOfWorkspaceFolders: number = getCountOfWorkspaceFolders();

                const innerProjectName: string = "innerSampleProject";
                const innerProjectDir: string = path.join(
                    sampleReactNativeProjectDir,
                    innerProjectName,
                );
                const innerNodeModulesDir: string = path.join(
                    innerProjectDir,
                    nodeModulesFolderName,
                );

                fsHelper.makeDirectoryRecursiveSync(innerNodeModulesDir);

                teardown(() => {
                    fsHelper.removePathRecursivelySync(innerProjectDir);
                });

                createAdditionalWorkspaceFolder(nodeModulesDir);

                const result: vscode.WorkspaceFolder | null =
                    createAdditionalWorkspaceFolder(innerNodeModulesDir);

                const expectedURI = vscode.Uri.file(innerNodeModulesDir);
                const expectedIndex: number = currentCountOfWorkspaceFolders + 2;

                const expectedResult: vscode.WorkspaceFolder = {
                    uri: expectedURI,
                    name: nodeModulesFolderName,
                    index: expectedIndex,
                };

                assert.deepStrictEqual(result, expectedResult);
            });
        });
    });

    suite("commandsRegistered", async () => {
        const fsHelper = new Node.FileSystem();

        const SAMPLE_PROJECT_NAME: string = "sampleReactNativeProject";
        const reactNativePackageDir = path.join(
            SAMPLE_PROJECT_NAME,
            "node_modules",
            "react-native",
        );

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(reactNativePackageDir);
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(path.join(SAMPLE_PROJECT_NAME, "node_modules"));
        });

        test("Verify that the commands registered by Cordova extension are loaded", async () => {
            const commandsAvailable: string[] = (await vscode.commands.getCommands(true)).filter(
                (commandName: string) => commandName.includes("reactNative."),
            );
            console.log(commandsAvailable);
            assert.deepStrictEqual(commandsAvailable, [
                "reactNative.doctor",
                "reactNative.expoDoctor",
                "reactNative.debugScenario.attachHermesApplication",
                "reactNative.debugScenario.attachDirectIosExperimental",
                "reactNative.debugScenario.attachToPackager",
                "reactNative.debugScenario.debugAndroid",
                "reactNative.debugScenario.debugIos",
                "reactNative.debugScenario.debugWindows",
                "reactNative.debugScenario.debugMacos",
                "reactNative.debugScenario.debugInExponent",
                "reactNative.debugScenario.debugInHermesExponent",
                "reactNative.debugScenario.debugInExponentWeb",
                "reactNative.debugScenario.debugAndroidHermes",
                "reactNative.debugScenario.debugDirectIosExperimental",
                "reactNative.debugScenario.debugIosHermes",
                "reactNative.debugScenario.debugMacosHermes",
                "reactNative.debugScenario.debugWindowsHermes",
                "reactNative.debugScenario.runAndroid",
                "reactNative.debugScenario.runIos",
                "reactNative.debugScenario.runAndroidHermes",
                "reactNative.debugScenario.runIosHermes",
                "reactNative.debugScenario.runDirectIosExperimental",
                "reactNative.runInspector",
                "reactNative.stopInspector",
                "reactNative.launchAndroidSimulator",
                "reactNative.launchIOSSimulator",
                "reactNative.launchExpoWeb",
                "reactNative.startNetworkInspector",
                "reactNative.stopNetworkInspector",
                "reactNative.publishToExpHost",
                "reactNative.reloadApp",
                "reactNative.restartPackager",
                "reactNative.runAndroidDevice",
                "reactNative.runAndroidSimulator",
                "reactNative.runExponent",
                "reactNative.runIosDevice",
                "reactNative.runIosSimulator",
                "reactNative.runMacOS",
                "reactNative.runWindows",
                "reactNative.selectAndInsertDebugConfiguration",
                "reactNative.showDevMenu",
                "reactNative.startLogCatMonitor",
                "reactNative.startPackager",
                "reactNative.stopLogCatMonitor",
                "reactNative.stopPackager",
                "reactNative.testDevEnvironment",
                "reactNative.createExpoEASBuildConfigFile",
                "reactNative.openEASProjectInWebPage",
                "reactNative.revertOpenModule",
                "reactNative.openRNUpgradeHelper",
                "reactNative.installExpoGoApplication",
                "reactNative.expoPrebuild",
                "reactNative.expoPrebuildClean",
                "reactNative.reopenQRCode",
                "reactNative.hermesEnable",
                "reactNative.expoHermesEnable",
                "reactNative.openExpoUpgradeHelper",
                "reactNative.killPort",
                "reactNative.setNewArch",
                "reactNative.toggleNetworkView",
                "reactNative.runEasBuild",
            ]);
        });
    });
});
