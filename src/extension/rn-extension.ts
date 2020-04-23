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
import {EntryPointHandler, ProcessType} from "../common/entryPointHandler";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalError} from "../common/error/internalError";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {SettingsHelper} from "./settingsHelper";
import {ProjectVersionHelper} from "../common/projectVersionHelper";
import {ReactDirManager} from "./reactDirManager";
import {Telemetry} from "../common/telemetry";
import {TelemetryHelper, ICommandTelemetryProperties} from "../common/telemetryHelper";
import {OutputChannelLogger} from "./log/OutputChannelLogger";
import {ReactNativeDebugConfigProvider} from "./debugConfigurationProvider";
import {RNDebugAdapterDescriptorFactory} from "./rnDebugAdapterDescriptorFactory";
import {ProjectsStorage} from "./projectsStorage";
import {AppLauncher} from "./appLauncher";
import {RNDebugSession} from "../debugger/rnDebugSession";
import {DirectDebugSession} from "../debugger/direct/directDebugSession";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();

/* all components use the same packager instance */
const outputChannelLogger = OutputChannelLogger.getMainChannel();
const entryPointHandler = new EntryPointHandler(ProcessType.Extension, outputChannelLogger);
const fsUtil = new FileSystem();
let debugConfigProvider: vscode.Disposable;

const APP_NAME = "react-native-tools";

interface ISetupableDisposable extends vscode.Disposable {
    setup(): Q.Promise<any>;
}

export function activate(context: vscode.ExtensionContext): Q.Promise<void> {
    outputChannelLogger.debug("Begin to activate...");
    const appVersion = require(path.resolve(__dirname, "../../package.json")).version;
    outputChannelLogger.debug(`Extension version: ${appVersion}`);
    const ExtensionTelemetryReporter = require("vscode-extension-telemetry").default;
    const reporter = new ExtensionTelemetryReporter(APP_NAME, appVersion, Telemetry.APPINSIGHTS_INSTRUMENTATIONKEY);
    const configProvider = new ReactNativeDebugConfigProvider();
    const workspaceFolders: vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    let extProps: ICommandTelemetryProperties = {};
    if (workspaceFolders) {
        extProps = {
            ["workspaceFoldersCount"]: {value: workspaceFolders.length, isPii: false},
        };
    }

    return entryPointHandler.runApp(APP_NAME, appVersion, ErrorHelper.getInternalError(InternalErrorCode.ExtensionActivationFailed), reporter, function activateRunApp() {
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders((event) => onChangeWorkspaceFolders(context, event)));
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => onChangeConfiguration(context)));

        debugConfigProvider = vscode.debug.registerDebugConfigurationProvider("reactnative", configProvider);

        const rnFactory = new RNDebugAdapterDescriptorFactory(RNDebugSession);
        const directFactory = new RNDebugAdapterDescriptorFactory(DirectDebugSession);
        context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory("reactnative", rnFactory));
        context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory("reactnativedirect", directFactory));

        let activateExtensionEvent = TelemetryHelper.createTelemetryEvent("activate");
        Telemetry.send(activateExtensionEvent);
        let promises: any = [];
        if (workspaceFolders) {
            outputChannelLogger.debug(`Projects found: ${workspaceFolders.length}`);
            workspaceFolders.forEach((folder: vscode.WorkspaceFolder) => {
                promises.push(onFolderAdded(context, folder));
            });
        } else {
            outputChannelLogger.warning("Could not find workspace while activating");
            TelemetryHelper.sendErrorEvent(
                "ActivateCouldNotFindWorkspace",
                ErrorHelper.getInternalError(InternalErrorCode.CouldNotFindWorkspace)
                );
        }

        return Q.all(promises).then(() => {
            return registerReactNativeCommands(context);
        });
    }, extProps);
}

export function deactivate(): Q.Promise<void> {
    return Q.Promise<void>(function (resolve) {
        // Kill any packager processes that we spawned
        entryPointHandler.runFunction("extension.deactivate",
            ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackagerOnExit),
            () => {
                debugConfigProvider.dispose();
                CommandPaletteHandler.stopAllPackagers()
                .then(() => {
                    return CommandPaletteHandler.stopElementInspector();
                })
                .done(() => {
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

function onChangeConfiguration(context: vscode.ExtensionContext) {
    // TODO implements
}

function onFolderAdded(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder): Q.Promise<void> {
    let rootPath = folder.uri.fsPath;
    let projectRootPath = SettingsHelper.getReactNativeProjectRoot(rootPath);
    outputChannelLogger.debug(`Add project: ${projectRootPath}`);
    return ProjectVersionHelper.getReactNativeVersions(projectRootPath)
        .then(versions => {
            outputChannelLogger.debug(`React Native version: ${versions.reactNativeVersion}`);
            let promises = [];
            if (ProjectVersionHelper.isVersionError(versions.reactNativeVersion)) {
                outputChannelLogger.debug(`react-native package version is not found in ${projectRootPath}. Reason: ${versions.reactNativeVersion}`);
                TelemetryHelper.sendErrorEvent(
                    "AddProjectReactNativeVersionIsEmpty",
                    ErrorHelper.getInternalError(InternalErrorCode.CouldNotFindProjectVersion),
                    versions.reactNativeVersion,
                    false
                );
            } else if (isSupportedVersion(versions.reactNativeVersion)) {
                promises.push(entryPointHandler.runFunction("debugger.setupLauncherStub", ErrorHelper.getInternalError(InternalErrorCode.DebuggerStubLauncherFailed), () => {
                    let reactDirManager = new ReactDirManager(rootPath);
                    return setupAndDispose(reactDirManager, context)
                        .then(() => {
                            ProjectsStorage.addFolder(folder, new AppLauncher(reactDirManager, folder));

                            return void 0;
                        });
                }));
                promises.push(entryPointHandler.runFunction("debugger.setupNodeDebuggerLocation",
                    ErrorHelper.getInternalError(InternalErrorCode.NodeDebuggerConfigurationFailed), () => {
                        return configureNodeDebuggerLocation();
                    }));
            } else {
                outputChannelLogger.debug(`react-native@${versions.reactNativeVersion} isn't supported`);
            }

            return Q.all(promises).then(() => {});
        });
}

function onFolderRemoved(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder): void {
    let appLauncher = ProjectsStorage.getFolder(folder);
    Object.keys(appLauncher).forEach((key) => {
        if (appLauncher[key].dispose) {
            appLauncher[key].dispose();
        }
    });
    outputChannelLogger.debug(`Delete project: ${folder.uri.fsPath}`);
    ProjectsStorage.delFolder(folder);

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
    if (!!semver.valid(version) && !semver.gte(version, "0.19.0")) {
        TelemetryHelper.sendSimpleEvent("unsupportedRNVersion", { rnVersion: version });
        const shortMessage = localize("ReactNativeToolsRequiresMoreRecentVersionThan019", "React Native Tools need React Native version 0.19.0 or later to be installed in <PROJECT_ROOT>/node_modules/");
        const longMessage = `${shortMessage}: ${version}`;
        vscode.window.showWarningMessage(shortMessage);
        outputChannelLogger.warning(longMessage);
        return false;
    } else {
        // !!semver.valid(version) === false is OK for us, someone can use custom RN implementation with custom version e.g. -> "0.2018.0107-v1"
        return true;
    }
}

function registerReactNativeCommands(context: vscode.ExtensionContext): void {
    registerVSCodeCommand(context, "runAndroidSimulator", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnAndroid), () => CommandPaletteHandler.runAndroid("simulator"));
    registerVSCodeCommand(context, "runAndroidDevice", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnAndroid), () => CommandPaletteHandler.runAndroid("device"));
    registerVSCodeCommand(context, "runIosSimulator", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnIos), () => CommandPaletteHandler.runIos("simulator"));
    registerVSCodeCommand(context, "runIosDevice", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnIos), () => CommandPaletteHandler.runIos("device"));
    registerVSCodeCommand(context, "runExponent", ErrorHelper.getInternalError(InternalErrorCode.FailedToRunExponent), () => CommandPaletteHandler.runExponent());
    registerVSCodeCommand(context, "startPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToStartPackager), () => CommandPaletteHandler.startPackager());
    registerVSCodeCommand(context, "stopPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackager), () => CommandPaletteHandler.stopPackager());
    registerVSCodeCommand(context, "restartPackager", ErrorHelper.getInternalError(InternalErrorCode.FailedToRestartPackager), () => CommandPaletteHandler.restartPackager());
    registerVSCodeCommand(context, "publishToExpHost", ErrorHelper.getInternalError(InternalErrorCode.FailedToPublishToExpHost), () => CommandPaletteHandler.publishToExpHost());
    registerVSCodeCommand(context, "showDevMenu", ErrorHelper.getInternalError(InternalErrorCode.CommandFailed, localize("ReactNativeShowDevMenu", "React Native: Show Developer Menu for app")), () => CommandPaletteHandler.showDevMenu());
    registerVSCodeCommand(context, "reloadApp", ErrorHelper.getInternalError(InternalErrorCode.CommandFailed, localize("ReactNativeReloadApp", "React Native: Reload App")), () => CommandPaletteHandler.reloadApp());
    registerVSCodeCommand(context, "runInspector", ErrorHelper.getInternalError(InternalErrorCode.CommandFailed, localize("ReactNativeRunElementInspector", "React Native: Run Element Inspector")), () => CommandPaletteHandler.runElementInspector());
}

function registerVSCodeCommand(context: vscode.ExtensionContext, commandName: string, error: InternalError, commandHandler: () => Q.Promise<void>): void {
    context.subscriptions.push(vscode.commands.registerCommand(`reactNative.${commandName}`, () => {
        const extProps = {
            platform: {
                value: CommandPaletteHandler.getPlatformByCommandName(commandName),
                isPii: false,
            },
        };
        outputChannelLogger.debug(`Run command: ${commandName}`);
        return entryPointHandler.runFunctionWExtProps(`commandPalette.${commandName}`, extProps, error, commandHandler);
    }));
}
