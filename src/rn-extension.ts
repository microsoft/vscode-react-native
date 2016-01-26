// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as fs from "fs";
import * as path from "path";
import * as Q from "q";
import * as vscode from "vscode";

import {ReactNativeCommandHelper} from "./utils/reactNativeCommandHelper";

function dropDebuggerStub(): void {
    let debuggerEntryPath = require.resolve("./debugger/reactNative/reactNative");
    // TODO: Update this stub to point to correct file/class once it is in
    let debuggerEntryCode = `var RN = require(${JSON.stringify(debuggerEntryPath)}).ReactNative;\nnew RN.Launcher(${JSON.stringify(vscode.workspace.rootPath)}).launch()`;
    let vscodeFolder = path.join(vscode.workspace.rootPath, ".vscode");
    let debugStub = path.join(vscodeFolder, "launchReactNative.js");

    Q.nfcall(fs.stat, vscodeFolder).then((stat: fs.Stats) => {
        if (stat && !stat.isDirectory()) {
            // .vscode exists but is not a folder: bail out
            throw new Error("Warning: Expected .vscode to be a folder. Debugging requires manual intervention.");
        }
    }, (err: Error & {code: string}) => {
        if (err && err.code === "ENOENT") {
            // No .vscode folder: create one
            fs.mkdirSync(vscodeFolder);
        } else {
            throw err;
        }
    }).then(() => {
        // At this point, .vscode folder exists and is a folder
        return Q.nfcall(fs.stat, debugStub).then((stat: fs.Stats) => {
            if (!stat.isFile()) {
                throw Error("Error: Expected .vscode/launchReactNative.js to be a file");
            }
            // File exists: lets leave it there and assume it was created by us
        }, (err: Error & {code: string}) => {
            if (err && err.code === "ENOENT") {
                fs.writeFileSync(debugStub, debuggerEntryCode);
            } else {
                throw err;
            }
        });
    }).catch((err: Error) => {
        vscode.window.showErrorMessage(err.message);
    });
}

function configureReactNativeWorkspace(): void {
    try {
        let packageJsonPath = path.join(vscode.workspace.rootPath, "package.json");
        let packageJsonContents = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        if (packageJsonContents && packageJsonContents.dependencies
            && "react-native" in packageJsonContents.dependencies) {
            // Looks like a react native project: Set it up for debugging
            dropDebuggerStub();
        }
    } catch (e) {
        // Project was malformed or not a react native project: do nothing.
    }
}

export function activate(context: vscode.ExtensionContext): void {
    // TODO:  Get the project root (vscode.workspace.rootPath) and return if it is not a react-native project
    // check if package.json of user project has dependency on react-native

    // NOTE: This triggers when other files in .vscode are modified as well, e.g. launch.json
    // We may need to be more specific in when we drop the debug file
    vscode.workspace.onDidChangeConfiguration(configureReactNativeWorkspace);
    configureReactNativeWorkspace();

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
