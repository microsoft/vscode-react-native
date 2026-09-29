// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as vscode from "vscode";
import * as path from "path";
import * as sinon from "sinon";
import { RN_VERSION_ERRORS } from "../../src/common/error/versionError";
import * as ExtensionHelper from "../../src/common/extensionHelper";
import { Node } from "../../src/common/node/node";
import { ProjectVersionHelper } from "../../src/common/projectVersionHelper";
import {
    createAdditionalWorkspaceFolder,
    getCountOfWorkspaceFolders,
    initializeWorkspaceFolders,
    onFolderAdded,
} from "../../src/extension/rn-extension";
suite("rn-extension", function () {
    suite("workspace trust", function () {
        const workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file("untrusted-workspace"),
            name: "untrusted-workspace",
            index: 0,
        };
        let isWorkspaceTrustedStub: Sinon.SinonStub;
        let getVersionsStub: Sinon.SinonStub;

        setup(() => {
            isWorkspaceTrustedStub = sinon.stub(ExtensionHelper, "isWorkspaceTrusted");
            getVersionsStub = sinon.stub(
                ProjectVersionHelper,
                "tryToGetRNSemverValidVersionsFromProjectPackage",
            );
        });

        teardown(() => {
            isWorkspaceTrustedStub.restore();
            getVersionsStub.restore();
        });

        test("does not inspect projects in Restricted Mode", async () => {
            isWorkspaceTrustedStub.returns(false);

            await onFolderAdded(workspaceFolder);

            sinon.assert.notCalled(getVersionsStub);
        });

        test("initializes current folders after workspace trust is granted", async () => {
            isWorkspaceTrustedStub.returns(false);
            getVersionsStub.returns(
                Promise.resolve({
                    reactNativeVersion: RN_VERSION_ERRORS.UNKNOWN_ERROR,
                    reactNativeWindowsVersion: RN_VERSION_ERRORS.UNKNOWN_ERROR,
                    reactNativeMacOSVersion: RN_VERSION_ERRORS.UNKNOWN_ERROR,
                }),
            );

            await initializeWorkspaceFolders([workspaceFolder]);
            sinon.assert.notCalled(getVersionsStub);

            isWorkspaceTrustedStub.returns(true);
            await initializeWorkspaceFolders([workspaceFolder]);

            sinon.assert.calledOnce(getVersionsStub);
        });
    });

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
            await vscode.extensions.getExtension("msjsdiag.vscode-react-native")?.activate();
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
                "reactNative.launchAndroidSimulator",
                "reactNative.launchIOSSimulator",
                "reactNative.launchExpoWeb",
                "reactNative.startNetworkInspector",
                "reactNative.stopNetworkInspector",
                "reactNative.reloadApp",
                "reactNative.restartPackager",
                "reactNative.cleanRestartPackager",
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
                "reactNative.installPods",
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
