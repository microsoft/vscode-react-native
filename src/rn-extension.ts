// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";

import {PackageJsonWatcher} from "./utils/packageJsonWatcher";
import {ReactNativeCommandExecutor} from "./utils/reactNativeCommandExecutor";

export function activate(context: vscode.ExtensionContext): void {
    // TODO:  Get the project root (vscode.workspace.rootPath) and return if it is not a react-native project
    // check if package.json of user project has dependency on react-native

    let packageJsonWatcher = new PackageJsonWatcher();
    packageJsonWatcher.startWatching();

    let reactNativeCommandExecutor = new ReactNativeCommandExecutor(vscode.workspace.rootPath);

    // TODO: Change to a foreach if this implementation is appropriate
    // Register react native commands
    context.subscriptions.push(vscode.commands.registerCommand("reactNative.runAndroid",
        () => reactNativeCommandExecutor.executeReactNativeCommand("run-android")));
    context.subscriptions.push(vscode.commands.registerCommand("reactNative.runIos",
        () => reactNativeCommandExecutor.executeReactNativeCommand("run-ios")));
    context.subscriptions.push(vscode.commands.registerCommand("reactNative.startPackager",
        () => reactNativeCommandExecutor.startPackager()));
    context.subscriptions.push(vscode.commands.registerCommand("reactNative.stopPackager",
        () => reactNativeCommandExecutor.stopPackager()));
}