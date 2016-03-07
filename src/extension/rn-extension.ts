// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {FileSystem} from "../common/node/fileSystem";
import * as path from "path";
import * as vscode from "vscode";
import {CommandPaletteHandler} from "./commandPaletteHandler";
import {Packager} from "../common/packager";
import {EntryPointHandler} from "../common/entryPointHandler";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalError} from "../common/error/internalError";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {Log} from "../common/log/log";
import {ReactNativeProjectHelper} from "../common/reactNativeProjectHelper";
import {ReactDirManager} from "./reactDirManager";
import {IntellisenseHelper} from "./intellisenseHelper";
import {TelemetryHelper} from "../common/telemetryHelper";
import {ExtensionServer} from "./extensionServer";
import {OutputChannelLogger} from "./outputChannelLogger";

/* all components use the same packager instance */
const globalPackager = new Packager(vscode.workspace.rootPath);
const commandPaletteHandler = new CommandPaletteHandler(vscode.workspace.rootPath, globalPackager);
const extensionServer = new ExtensionServer(globalPackager);

const outputChannelLogger = new OutputChannelLogger(vscode.window.createOutputChannel("React-Native"));
const entryPointHandler = new EntryPointHandler(false, outputChannelLogger);
const reactNativeProjectHelper = new ReactNativeProjectHelper(vscode.workspace.rootPath);
const fsUtil = new FileSystem();

export function activate(context: vscode.ExtensionContext): void {
    entryPointHandler.runApp("react-native", () => <string>require("../../package.json").version,
        ErrorHelper.getInternalError(InternalErrorCode.ExtensionActivationFailed), () => {
        return reactNativeProjectHelper.isReactNativeProject()
            .then(isRNProject => {
                if (isRNProject) {
                    warnWhenReactNativeVersionIsNotSupported();
                    entryPointHandler.runFunction("debugger.setupLauncherStub",
                        ErrorHelper.getInternalError(InternalErrorCode.DebuggerStubLauncherFailed), () =>
                        setupReactNativeDebugger()
                            .then(() => setupReactDir(context))
                            .then(() => setupExtensionServer(context)));
                    entryPointHandler.runFunction("intelliSense.setup",
                        ErrorHelper.getInternalError(InternalErrorCode.IntellisenseSetupFailed), () =>
                        IntellisenseHelper.setupReactNativeIntellisense());
                }
                entryPointHandler.runFunction("debugger.setupNodeDebuggerLocation",
                    ErrorHelper.getInternalError(InternalErrorCode.NodeDebuggerConfigurationFailed), () =>
                    configureNodeDebuggerLocation());
                registerReactNativeCommands(context);
            });
    });
}

export function deactivate(): void {
    // Kill any packager processes that we spawned
    entryPointHandler.runFunction("extension.deactivate",
        ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackagerOnExit),
        () => {
            commandPaletteHandler.stopPackager();
        }, /*errorsAreFatal*/ true);
}

function configureNodeDebuggerLocation(): Q.Promise<void> {
    const nodeDebugPath = vscode.extensions.getExtension("andreweinand.node-debug").extensionPath;
    return fsUtil.writeFile(path.resolve(__dirname, "../", "debugger", "nodeDebugLocation.json"), JSON.stringify({ nodeDebugPath }));
}

function setupReactDir(context: vscode.ExtensionContext): Q.Promise<void> {
    const reactDirManager = new ReactDirManager();
    return reactDirManager.create()
        .then(() => {
            context.subscriptions.push(reactDirManager);
        });
}

function setupExtensionServer(context: vscode.ExtensionContext): Q.Promise<void> {
    return extensionServer.setup()
        .then(() => {
            context.subscriptions.push(extensionServer);
        });
}

function warnWhenReactNativeVersionIsNotSupported(): void {
    return reactNativeProjectHelper.validateReactNativeVersion().done(() => { }, reason => {
        TelemetryHelper.sendSimpleEvent("unsupportedRNVersion", { rnVersion: reason });
        const shortMessage = `React Native Tools only supports React Native versions 0.19.0 and later`;
        const longMessage = `${shortMessage}: ${reason}`;
        vscode.window.showWarningMessage(shortMessage);
        Log.logMessage(longMessage);
    });
}

function registerReactNativeCommands(context: vscode.ExtensionContext): void {
    // Register React Native commands
    registerVSCodeCommand(context, "runAndroid", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnAndroid), () => commandPaletteHandler.runAndroid());
    registerVSCodeCommand(context, "runIos", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnIos), () => commandPaletteHandler.runIos());
    registerVSCodeCommand(context, "startPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToStartPackager), () => commandPaletteHandler.startPackager());
    registerVSCodeCommand(context, "stopPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackager), () => commandPaletteHandler.stopPackager());
}

function registerVSCodeCommand(
    context: vscode.ExtensionContext, commandName: string,
    error: InternalError, commandHandler: () => Q.Promise<void>): void {
    context.subscriptions.push(vscode.commands.registerCommand(
        `reactNative.${commandName}`,
        () =>
            entryPointHandler.runFunction(
                `commandPalette.${commandName}`, error,
                commandHandler)));
}

/**
 * Sets up the debugger for the React Native project by dropping
 * the debugger stub into the workspace
 */
function setupReactNativeDebugger(): Q.Promise<void> {
    const launcherPath = require.resolve("../debugger/launcher");
    const pkg = require("../../package.json");
    const extensionVersionNumber = pkg.version;
    const extensionName = pkg.name;

    let debuggerEntryCode =
        `// This file is automatically generated by ${extensionName}@${extensionVersionNumber}
// Please do not modify it manually. All changes will be lost.
try {
    var path = require("path");
    var Launcher = require(${JSON.stringify(launcherPath)}).Launcher;
    new Launcher(path.resolve(__dirname, "..")).launch();
} catch (e) {
    throw new Error("Unable to launch application. Try deleting .vscode/launchReactNative.js and restarting vscode.");
}`;

    const vscodeFolder = path.join(vscode.workspace.rootPath, ".vscode");
    const debugStub = path.join(vscodeFolder, "launchReactNative.js");

    return fsUtil.ensureDirectory(vscodeFolder)
        .then(() => fsUtil.ensureFileWithContents(debugStub, debuggerEntryCode))
        .catch((err: Error) => {
            vscode.window.showErrorMessage(err.message);
        });
}