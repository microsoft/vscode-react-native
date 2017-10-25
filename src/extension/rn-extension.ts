// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// @ifdef DEBUG
try {
    /* tslint:disable:no-var-requires */
    require("fs").statSync(`${__filename}.map`); // We check if source maps are available
    require("source-map-support").install(); // If they are, we enable stack traces translation to typescript
    /* tslint:enable:no-var-requires */
} catch (exceptions) {
    // If something goes wrong, we just ignore the errors
}
// @endif

import * as Q from "q";
import * as path from "path";
import * as vscode from "vscode";
import * as semver from "semver";

import {FileSystem} from "../common/node/fileSystem";
import {CommandPaletteHandler} from "./commandPaletteHandler";
import {Packager} from "../common/packager";
import {EntryPointHandler, ProcessType} from "../common/entryPointHandler";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalError} from "../common/error/internalError";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {SettingsHelper} from "./settingsHelper";
import {PackagerStatusIndicator} from "./packagerStatusIndicator";
import {ReactNativeProjectHelper} from "../common/reactNativeProjectHelper";
import {ReactDirManager} from "./reactDirManager";
import {Telemetry} from "../common/telemetry";
import {TelemetryHelper} from "../common/telemetryHelper";
import {ExtensionServer} from "./extensionServer";
import {OutputChannelLogger} from "./log/OutputChannelLogger";
import {ExponentHelper} from "./exponent/exponentHelper";
import {QRCodeContentProvider} from "./qrCodeContentProvider";

/* all components use the same packager instance */
const outputChannelLogger = OutputChannelLogger.getMainChannel();
const entryPointHandler = new EntryPointHandler(ProcessType.Extension, outputChannelLogger);
const fsUtil = new FileSystem();

interface ISetupableDisposable extends vscode.Disposable {
    setup(): Q.Promise<any>;
}

export function activate(context: vscode.ExtensionContext): void {
    const appVersion = <string>require("../../package.json").version;
    const reporter = Telemetry.defaultTelemetryReporter(appVersion);
    entryPointHandler.runApp("react-native", appVersion, ErrorHelper.getInternalError(InternalErrorCode.ExtensionActivationFailed), reporter, () => {
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders((event) => onChangeWorkspaceFolders(context, event)));
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => onChangeConfiguration(context, event)));
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("exp", new QRCodeContentProvider()));
        registerReactNativeCommands(context);

        let activateExtensionEvent = TelemetryHelper.createTelemetryEvent("activate");
        Telemetry.send(activateExtensionEvent);

        const workspaceFolders: vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            workspaceFolders.forEach((folder: vscode.WorkspaceFolder) => {
                onFolderAdded(context, folder);
            });
        }
    });
}

export function deactivate(): Q.Promise<void> {
    return Q.Promise<void>(function (resolve) {
        // Kill any packager processes that we spawned
        entryPointHandler.runFunction("extension.deactivate",
            ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackagerOnExit),
            () => {
                CommandPaletteHandler.stopAllPackagers().done(() => {
                    // Tell vscode that we are done with deactivation
                    resolve(void 0);
                });
            }, /*errorsAreFatal*/ true);
    });
}

function onChangeWorkspaceFolders(context: vscode.ExtensionContext, event: vscode.WorkspaceFoldersChangeEvent) {
    if (event.removed.length) {
        event.removed.forEach((folder) => {
            onFolderRemoved(context, folder);
        });
    }

    if (event.added.length) {
        event.added.forEach((folder) => {
            onFolderAdded(context, folder);
        });
    }
}

function onChangeConfiguration(context: vscode.ExtensionContext, event: any) {
    // TODO implements
    vscode.window.showWarningMessage("React-Native Tools: Settings were changed, Please restart VSCode to apply their");
}

function onFolderAdded(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder): void {
    let rootPath = folder.uri.fsPath;

    ReactNativeProjectHelper.getReactNativeVersion(rootPath)
        .then(version => {
                if (version && isSupportedVersion(version)) {
                    entryPointHandler.runFunction("debugger.setupLauncherStub", ErrorHelper.getInternalError(InternalErrorCode.DebuggerStubLauncherFailed), () => {
                            let reactDirManager = new ReactDirManager(rootPath);
                            return setupAndDispose(reactDirManager, context)
                                .then(() => {
                                    let projectRootPath = SettingsHelper.getReactNativeProjectRoot(folder.uri.fsPath);
                                    let exponentHelper: ExponentHelper = new ExponentHelper(rootPath, projectRootPath);
                                    let packagerStatusIndicator: PackagerStatusIndicator = new PackagerStatusIndicator();
                                    let packager: Packager = new Packager(rootPath, projectRootPath, SettingsHelper.getPackagerPort(folder.uri.fsPath), packagerStatusIndicator);
                                    let extensionServer: ExtensionServer = new ExtensionServer(rootPath, packager);

                                    setupAndDispose(extensionServer, context);
                                    CommandPaletteHandler.addFolder(folder, {
                                        packager,
                                        exponentHelper,
                                        reactDirManager,
                                        extensionServer,
                                    });
                                });
                        });

                    entryPointHandler.runFunction("debugger.setupNodeDebuggerLocation",
                        ErrorHelper.getInternalError(InternalErrorCode.NodeDebuggerConfigurationFailed), () => {
                            configureNodeDebuggerLocation();
                        });
                }
        });
}

function onFolderRemoved(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder): void {
    let project = CommandPaletteHandler.getFolder(folder);
    Object.keys(project).forEach((key) => {
        if (project[key].dispose) {
            project[key].dispose();
        }
    });
    CommandPaletteHandler.delFolder(folder);

    try { // Preventing memory leaks
        context.subscriptions.forEach((element: any, index: number) => {
            if (element.isDisposed) {
                context.subscriptions.splice(index, 1); // Array.prototype.filter doesn't work, "context.subscriptions" is read only
            }
        });
    } catch (err) {
        // Ignore
    }
}

function configureNodeDebuggerLocation(): Q.Promise<void> {
    const nodeDebugExtension = vscode.extensions.getExtension("ms-vscode.node-debug2");
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

function isSupportedVersion(version: string): boolean {
    if (!semver.gte(version, "0.19.0")) {
        TelemetryHelper.sendSimpleEvent("unsupportedRNVersion", { rnVersion: version });
        const shortMessage = `React Native Tools need React Native version 0.19.0 or later to be installed in <PROJECT_ROOT>/node_modules/`;
        const longMessage = `${shortMessage}: ${version}`;
        vscode.window.showWarningMessage(shortMessage);
        outputChannelLogger.warning(longMessage);
        return false;
    } else {
        return true;
    }
}

function registerReactNativeCommands(context: vscode.ExtensionContext): void {
    // Register React Native commands
    registerVSCodeCommand(context, "runAndroidSimulator", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnAndroid), () => CommandPaletteHandler.runAndroid("simulator"));
    registerVSCodeCommand(context, "runAndroidDevice", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnAndroid), () => CommandPaletteHandler.runAndroid("device"));
    registerVSCodeCommand(context, "runIosSimulator", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnIos), () => CommandPaletteHandler.runIos("simulator"));
    registerVSCodeCommand(context, "runIosDevice", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnIos), () => CommandPaletteHandler.runIos("device"));
    registerVSCodeCommand(context, "startPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToStartPackager), () => CommandPaletteHandler.startPackager());
    registerVSCodeCommand(context, "startExponentPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToStartExponentPackager), () => CommandPaletteHandler.startExponentPackager());
    registerVSCodeCommand(context, "stopPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackager), () => CommandPaletteHandler.stopPackager());
    registerVSCodeCommand(context, "restartPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToRestartPackager), () => CommandPaletteHandler.restartPackager());
    registerVSCodeCommand(context, "publishToExpHost", ErrorHelper.getInternalError(InternalErrorCode.FailedToPublishToExpHost), () => CommandPaletteHandler.publishToExpHost());
    registerVSCodeCommand(context, "showDevMenu", ErrorHelper.getInternalError(InternalErrorCode.CommandFailed), () => CommandPaletteHandler.showDevMenu());
    registerVSCodeCommand(context, "reloadApp", ErrorHelper.getInternalError(InternalErrorCode.CommandFailed), () => CommandPaletteHandler.reloadApp());
}

function registerVSCodeCommand(context: vscode.ExtensionContext, commandName: string, error: InternalError, commandHandler: () => Q.Promise<void>): void {
    context.subscriptions.push(vscode.commands.registerCommand(`reactNative.${commandName}`, () => {
        return entryPointHandler.runFunction(`commandPalette.${commandName}`, error, commandHandler);
    }));
}
