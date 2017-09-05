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

import {FileSystem} from "../common/node/fileSystem";
import {CommandPaletteHandler} from "./commandPaletteHandler";
import {Packager} from "../common/packager";
import {EntryPointHandler, ProcessType} from "../common/entryPointHandler";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalError} from "../common/error/internalError";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {Log} from "../common/log/log";
import {LogHelper} from "../common/log/logHelper";
import {SettingsHelper} from "./settingsHelper";
import {PackagerStatusIndicator} from "./packagerStatusIndicator";
import {ReactNativeProjectHelper} from "../common/reactNativeProjectHelper";
import {ReactDirManager} from "./reactDirManager";
import {IntellisenseHelper} from "./intellisenseHelper";
import {Telemetry} from "../common/telemetry";
import {TelemetryHelper} from "../common/telemetryHelper";
import {ExtensionServer} from "./extensionServer";
import {DelayedOutputChannelLogger} from "./outputChannelLogger";
import { ExponentHelper } from "../common/exponent/exponentHelper";
import { QRCodeContentProvider } from "./qrCodeContentProvider";
import { ConfigurationReader } from "../common/configurationReader";

/* all components use the same packager instance */
const projectRootPath = SettingsHelper.getReactNativeProjectRoot();
const workspaceRootPath = vscode.workspace.rootPath;

const packagerPort = ConfigurationReader.readIntWithDefaultSync(
    Packager.DEFAULT_PORT, SettingsHelper.getPackagerPort());

const globalPackager = new Packager(workspaceRootPath, projectRootPath, packagerPort);
const packagerStatusIndicator = new PackagerStatusIndicator();
const globalExponentHelper = new ExponentHelper(workspaceRootPath, projectRootPath);
const commandPaletteHandler = new CommandPaletteHandler(projectRootPath, globalPackager, packagerStatusIndicator, globalExponentHelper);

const outputChannelLogger = new DelayedOutputChannelLogger("React-Native");
const entryPointHandler = new EntryPointHandler(ProcessType.Extension, outputChannelLogger);
const reactNativeProjectHelper = new ReactNativeProjectHelper(projectRootPath);
const fsUtil = new FileSystem();

interface ISetupableDisposable extends vscode.Disposable {
    setup(): Q.Promise<any>;
}

export function activate(context: vscode.ExtensionContext): void {
    configureLogLevel();
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
                            setupAndDispose(new ReactDirManager(), context)
                            .then(() =>
                                setupAndDispose(new ExtensionServer(projectRootPath, globalPackager, packagerStatusIndicator), context))
                            .then(() => {}));
                    entryPointHandler.runFunction("intelliSense.setup",
                        ErrorHelper.getInternalError(InternalErrorCode.IntellisenseSetupFailed), () =>
                        IntellisenseHelper.setupReactNativeIntellisense());
                }
                entryPointHandler.runFunction("debugger.setupNodeDebuggerLocation",
                    ErrorHelper.getInternalError(InternalErrorCode.NodeDebuggerConfigurationFailed), () => {
                        configureNodeDebuggerLocation();
                    });

                registerReactNativeCommands(context);
                context.subscriptions.push(vscode.workspace
                    .registerTextDocumentContentProvider("exp", new QRCodeContentProvider()));
            });
    });
}

export function deactivate(): Q.Promise<void> {
    return Q.Promise<void>(function (resolve) {
        // Kill any packager processes that we spawned
        entryPointHandler.runFunction("extension.deactivate",
            ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackagerOnExit),
            () => {
                commandPaletteHandler.stopPackager().done(() => {
                    // Tell vscode that we are done with deactivation
                    resolve(void 0);
                });
            }, /*errorsAreFatal*/ true);
    });
}

function configureLogLevel(): void {
    LogHelper.logLevel = SettingsHelper.getLogLevel();
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
    registerVSCodeCommand(context, "runAndroidSimulator", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnAndroid), () => commandPaletteHandler.runAndroid("simulator"));
    registerVSCodeCommand(context, "runAndroidDevice", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnAndroid), () => commandPaletteHandler.runAndroid("device"));
    registerVSCodeCommand(context, "runIosSimulator", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnIos), () => commandPaletteHandler.runIos("simulator"));
    registerVSCodeCommand(context, "runIosDevice", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnIos), () => commandPaletteHandler.runIos("device"));
    registerVSCodeCommand(context, "startPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToStartPackager), () => commandPaletteHandler.startPackager());
    registerVSCodeCommand(context, "startExponentPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToStartExponentPackager), () => commandPaletteHandler.startExponentPackager());
    registerVSCodeCommand(context, "stopPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackager), () => commandPaletteHandler.stopPackager());
    registerVSCodeCommand(context, "restartPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToRestartPackager), () => commandPaletteHandler.restartPackager());
    registerVSCodeCommand(context, "publishToExpHost", ErrorHelper.getInternalError(InternalErrorCode.FailedToPublishToExpHost), () => commandPaletteHandler.publishToExpHost());
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
