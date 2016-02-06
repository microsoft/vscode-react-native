// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import {FileSystem} from "./utils/node/fileSystem";
import * as path from "path";
import {PackageJsonWatcher} from "./utils/packageJsonWatcher";
import {ReactNativeCommandHelper} from "./utils/reactNativeCommandHelper";

export function activate(context: vscode.ExtensionContext): void {
    // TODO:  Get the project root (vscode.workspace.rootPath) and return if it is not a react-native project
    // check if package.json of user project has dependency on react-native

    let reactDir = new ReactDirManager();
    reactDir.init();
    context.subscriptions.push(reactDir);

    let packageJsonWatcher = new PackageJsonWatcher();
    packageJsonWatcher.startWatching();


    // TODO: Change to a foreach if this implementation is appropriate
    // Register react native commands
    context.subscriptions.push(vscode.commands.registerCommand("reactNative.runAndroid",
        () => ReactNativeCommandHelper.executeReactNativeCommand(vscode.workspace.rootPath, "runAndroid")));
    context.subscriptions.push(vscode.commands.registerCommand("reactNative.runIos",
        () => ReactNativeCommandHelper.executeReactNativeCommand(vscode.workspace.rootPath, "runIos")));
    context.subscriptions.push(vscode.commands.registerCommand("reactNative.startPackager",
        () => ReactNativeCommandHelper.executeReactNativeCommand(vscode.workspace.rootPath, "startPackager")));
    context.subscriptions.push(vscode.commands.registerCommand("reactNative.stopPackager",
        () => ReactNativeCommandHelper.executeReactNativeCommand(vscode.workspace.rootPath, "stopPackager")));
}

/**
 * Manages the lifecycle of the .vscode/.react folder, which hosts the temporary source/map files we need for debugging.
 * We use synchronous operations here because we want to return after the init/cleanup has been done.
 */
class ReactDirManager implements vscode.Disposable {
    public static ReactDirPath = path.join(vscode.workspace.rootPath, ".vscode", ".react");

    public init(): void {
        let fs = new FileSystem();
        /* if the folder exists, remove it, then recreate it */
        fs.removePathRecursivelyAsync(ReactDirManager.ReactDirPath)
            .done(() => fs.mkDir(ReactDirManager.ReactDirPath));
    }

    public dispose(): void {
        new FileSystem().removePathRecursivelySync(ReactDirManager.ReactDirPath);
    }
}