// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";

// @ifdef DEBUG
try {
    fs.statSync(`${__filename}.map`); // We check if source maps are available
    /* tslint:disable:no-var-requires */
    require("source-map-support").install(); // If they are, we enable stack traces translation to typescript
    /* tslint:enable:no-var-requires */
} catch (exceptions) {
    // If something goes wrong, we just ignore the errors
}
// @endif

import * as Q from "q";
import * as path from "path";
import * as vscode from "vscode";

import {FileSystem} from "../common/node/fileSystem";
import {CommandPaletteHandler} from "./commandPaletteHandler";
import {Packager} from "../common/packager";
import {EntryPointHandler, ProcessType} from "../common/entryPointHandler";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalError} from "../common/error/internalError";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {Log} from "../common/log/log";
import {PackagerStatusIndicator} from "./packagerStatusIndicator";
import {ReactNativeProjectHelper} from "../common/reactNativeProjectHelper";
import {ReactDirManager} from "./reactDirManager";
import {IntellisenseHelper} from "./intellisenseHelper";
import {Telemetry} from "../common/telemetry";
import {TelemetryHelper} from "../common/telemetryHelper";
import {ExtensionServer} from "./extensionServer";
import {OutputChannelLogger} from "./outputChannelLogger";

/* all components use the same packager instance */
const projectRootPath = vscode.workspace.rootPath;
const globalPackager = new Packager(projectRootPath);
const packagerStatusIndicator = new PackagerStatusIndicator();
const commandPaletteHandler = new CommandPaletteHandler(projectRootPath, globalPackager, packagerStatusIndicator);

const outputChannelLogger = new OutputChannelLogger(vscode.window.createOutputChannel("React-Native"));
const entryPointHandler = new EntryPointHandler(ProcessType.Extension, outputChannelLogger);
const reactNativeProjectHelper = new ReactNativeProjectHelper(projectRootPath);
const fsUtil = new FileSystem();

interface ISetupableDisposable extends vscode.Disposable {
    setup(): Q.Promise<any>;
}

export function activate(context: vscode.ExtensionContext): void {
    entryPointHandler.runApp("react-native", () => <string>require("../../package.json").version,
        ErrorHelper.getInternalError(InternalErrorCode.ExtensionActivationFailed), projectRootPath, () => {
        return reactNativeProjectHelper.isReactNativeProject()
            .then(isRNProject => {
                if (isRNProject) {
                    let activateExtensionEvent = TelemetryHelper.createTelemetryEvent("activate");
                    Telemetry.send(activateExtensionEvent);

                    warnWhenReactNativeVersionIsNotSupported();
                    entryPointHandler.runFunction("debugger.setupLauncherStub",
                        ErrorHelper.getInternalError(InternalErrorCode.DebuggerStubLauncherFailed), () =>
                        setupReactNativeDebugger()
                            .then(() =>
                                setupAndDispose(new ReactDirManager(), context))
                            .then(() =>
                                setupAndDispose(new ExtensionServer(projectRootPath, globalPackager, packagerStatusIndicator), context))
                            .then(() => {}));
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
    const nodeDebugExtension = vscode.extensions.getExtension("ms-vscode.node-debug") // We try to get the new version
        || vscode.extensions.getExtension("andreweinand.node-debug"); // If it's not available, we try to get the old version
    if (!nodeDebugExtension) {
        return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.CouldNotFindLocationOfNodeDebugger));
    }
    const nodeDebugPath = nodeDebugExtension.extensionPath;
    return fsUtil.writeFile(path.resolve(__dirname, "../", "debugger", "nodeDebugLocation.json"), JSON.stringify({ nodeDebugPath }));
}

function setupAndDispose<T extends ISetupableDisposable>(setuptableDisposable: T, context: vscode.ExtensionContext): Q.Promise<T> {
    return setuptableDisposable.setup()
        .then(() => {
            context.subscriptions.push(setuptableDisposable);
            return setuptableDisposable;
        });
}

function warnWhenReactNativeVersionIsNotSupported(): void {
    return reactNativeProjectHelper.validateReactNativeVersion().done(() => { }, reason => {
        TelemetryHelper.sendSimpleEvent("unsupportedRNVersion", { rnVersion: reason });
        const shortMessage = `React Native Tools need React Native version 0.19.0 or later to be installed in <PROJECT_ROOT>/node_modules/`;
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

    const vscodeFolder = path.join(projectRootPath, ".vscode");
    const debugStub = path.join(vscodeFolder, "launchReactNative.js");

    return fsUtil.ensureDirectory(vscodeFolder)
        .then(() => fsUtil.ensureFileWithContents(debugStub, debuggerEntryCode))
        .catch((err: Error) => {
            vscode.window.showErrorMessage(err.message);
        });
}