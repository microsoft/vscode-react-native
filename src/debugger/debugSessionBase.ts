// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as vscode from "vscode";
import { LoggingDebugSession, Logger, logger, ErrorDestination } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import * as nls from "vscode-nls";
import { getLoggingDirectory, LogHelper, LogLevel } from "../extension/log/LogHelper";
import { ReactNativeProjectHelper } from "../common/reactNativeProjectHelper";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { InternalError, NestedError } from "../common/error/internalError";
import { ILaunchArgs, IRunOptions, PlatformType } from "../extension/launchArgs";
import { AppLauncher } from "../extension/appLauncher";
import { RNPackageVersions } from "../common/projectVersionHelper";
import { SettingsHelper } from "../extension/settingsHelper";
import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";
import { RNSession } from "./debugSessionWrapper";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

/**
 * Enum of possible statuses of debug session
 */
export enum DebugSessionStatus {
    /** A session has been just created */
    FirstConnection,
    /** This status is required in order to exclude the possible creation of several debug sessions at the first start */
    FirstConnectionPending,
    /** This status means that an application can be reloaded */
    ConnectionAllowed,
    /** This status means that an application is reloading now, and we shouldn't terminate the current debug session */
    ConnectionPending,
    /** A debuggee connected successfully */
    ConnectionDone,
    /** A debuggee failed to connect */
    ConnectionFailed,
    /** The session is handling disconnect request now */
    Stopping,
    /** The session is stopped */
    Stopped,
}

export interface TerminateEventArgs {
    debugSession: vscode.DebugSession;
    args: any;
}

export interface IAttachRequestArgs
    extends DebugProtocol.AttachRequestArguments,
        IRunOptions,
        vscode.DebugConfiguration {
    webkitRangeMax: number;
    webkitRangeMin: number;
    cwd: string /* Automatically set by VS Code to the currently opened folder */;
    port: number;
    url?: string;
    useHermesEngine: boolean;
    address?: string;
    trace?: string;
    skipFiles?: [];
    sourceMaps?: boolean;
    sourceMapPathOverrides?: { [key: string]: string };
}

export interface ILaunchRequestArgs
    extends DebugProtocol.LaunchRequestArguments,
        IAttachRequestArgs {}

export abstract class DebugSessionBase extends LoggingDebugSession {
    protected static rootSessionTerminatedEventEmitter: vscode.EventEmitter<TerminateEventArgs> =
        new vscode.EventEmitter<TerminateEventArgs>();
    public static readonly onDidTerminateRootDebugSession =
        DebugSessionBase.rootSessionTerminatedEventEmitter.event;

    protected readonly stopCommand: string;
    protected readonly terminateCommand: string;
    protected readonly pwaNodeSessionName: string;

    protected appLauncher: AppLauncher;
    protected projectRootPath: string;
    protected isSettingsInitialized: boolean; // used to prevent parameters reinitialization when attach is called from launch function
    protected previousAttachArgs: IAttachRequestArgs;
    protected cdpProxyLogLevel: LogLevel;
    protected debugSessionStatus: DebugSessionStatus;
    protected nodeSession: vscode.DebugSession | null;
    protected rnSession: RNSession;
    protected vsCodeDebugSession: vscode.DebugSession;
    protected cancellationTokenSource: vscode.CancellationTokenSource;

    constructor(rnSession: RNSession) {
        super();

        // constants definition
        this.pwaNodeSessionName = "pwa-node"; // the name of node debug session created by js-debug extension
        this.stopCommand = "workbench.action.debug.stop"; // the command which simulates a click on the "Stop" button
        this.terminateCommand = "terminate"; // the "terminate" command is sent from the client to the debug adapter in order to give the debuggee a chance for terminating itself

        // variables definition
        this.rnSession = rnSession;
        this.vsCodeDebugSession = rnSession.vsCodeDebugSession;
        this.isSettingsInitialized = false;
        this.debugSessionStatus = DebugSessionStatus.FirstConnection;
        this.cancellationTokenSource = new vscode.CancellationTokenSource();
        this.nodeSession = null;
    }

    protected initializeRequest(
        response: DebugProtocol.InitializeResponse,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        args: DebugProtocol.InitializeRequestArguments,
    ): void {
        response.body = response.body || {};

        response.body.supportsConfigurationDoneRequest = true;
        response.body.supportsEvaluateForHovers = true;
        response.body.supportTerminateDebuggee = true;
        response.body.supportsCancelRequest = true;

        this.sendResponse(response);
    }

    protected abstract establishDebugSession(
        attachArgs: IAttachRequestArgs,
        resolve?: (value?: void | PromiseLike<void> | undefined) => void,
    ): void;

    protected async initializeSettings(args: any): Promise<void> {
        if (!this.isSettingsInitialized) {
            let chromeDebugCoreLogs = getLoggingDirectory();
            if (chromeDebugCoreLogs) {
                chromeDebugCoreLogs = path.join(chromeDebugCoreLogs, "DebugSessionLogs.txt");
            }
            let logLevel: string = args.trace;
            if (logLevel) {
                logLevel = logLevel.replace(logLevel[0], logLevel[0].toUpperCase());
                logger.setup(Logger.LogLevel[logLevel], chromeDebugCoreLogs || false);
                this.cdpProxyLogLevel =
                    LogLevel[logLevel] === LogLevel.Verbose ? LogLevel.Custom : LogLevel.None;
            } else {
                logger.setup(Logger.LogLevel.Log, chromeDebugCoreLogs || false);
                this.cdpProxyLogLevel =
                    LogHelper.LOG_LEVEL === LogLevel.Trace ? LogLevel.Custom : LogLevel.None;
            }

            if (typeof args.sourceMaps !== "boolean") {
                args.sourceMaps = true;
            }

            if (typeof args.enableDebug !== "boolean") {
                args.enableDebug = true;
            }

            // Now there is a problem with processing time of 'createFromSourceMap' function of js-debug
            // So we disable this functionality by default https://github.com/microsoft/vscode-js-debug/issues/1033
            if (typeof args.sourceMapRenames !== "boolean") {
                args.sourceMapRenames = false;
            }

            const projectRootPath = SettingsHelper.getReactNativeProjectRoot(args.cwd);
            const isReactProject = await ReactNativeProjectHelper.isReactNativeProject(
                projectRootPath,
            );
            if (!isReactProject) {
                throw ErrorHelper.getInternalError(InternalErrorCode.NotInReactNativeFolderError);
            }

            const appLauncher = await AppLauncher.getOrCreateAppLauncherByProjectRootPath(
                projectRootPath,
            );
            this.appLauncher = appLauncher;
            this.projectRootPath = projectRootPath;
            this.isSettingsInitialized = true;
            this.appLauncher.getOrUpdateNodeModulesRoot(true);
            if (this.vsCodeDebugSession.workspaceFolder) {
                this.appLauncher.updateDebugConfigurationRoot(
                    this.vsCodeDebugSession.workspaceFolder.uri.fsPath,
                );
            }
        }
    }

    protected async disconnectRequest(
        response: DebugProtocol.DisconnectResponse,
        args: DebugProtocol.DisconnectArguments,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        request?: DebugProtocol.Request,
    ): Promise<void> {
        if (this.appLauncher) {
            await this.appLauncher.getRnCdpProxy().stopServer();
        }

        this.cancellationTokenSource.cancel();
        this.cancellationTokenSource.dispose();

        // Then we tell the extension to stop monitoring the logcat, and then we disconnect the debugging session
        if (this.previousAttachArgs && this.previousAttachArgs.platform === PlatformType.Android) {
            try {
                this.appLauncher.getMobilePlatform().dispose();
            } catch (err) {
                logger.warn(
                    localize(
                        "CouldNotStopMonitoringLogcat",
                        "Couldn't stop monitoring logcat: {0}",
                        err.message || err,
                    ),
                );
            }
        }

        this.debugSessionStatus = DebugSessionStatus.Stopped;
        await logger.dispose();

        DebugSessionBase.rootSessionTerminatedEventEmitter.fire({
            debugSession: this.vsCodeDebugSession,
            args: {
                forcedStop: !!(<any>args).forcedStop,
            },
        });

        this.sendResponse(response);
    }

    protected terminateWithErrorResponse(error: Error, response: DebugProtocol.Response): void {
        // We can't print error messages after the debugging session is stopped. This could break the extension work.
        if (
            (error instanceof InternalError || error instanceof NestedError) &&
            error.errorCode === InternalErrorCode.CancellationTokenTriggered
        ) {
            return;
        }

        logger.error(error.message);

        this.sendErrorResponse(
            response,
            { format: error.message, id: 1 },
            undefined,
            undefined,
            ErrorDestination.User,
        );
    }

    protected async preparePackagerBeforeAttach(
        args: IAttachRequestArgs,
        reactNativeVersions: RNPackageVersions,
    ): Promise<void> {
        if (!(await this.appLauncher.getPackager().isRunning())) {
            const runOptions: ILaunchArgs = Object.assign(
                { reactNativeVersions },
                this.appLauncher.prepareBaseRunOptions(args),
            );
            this.appLauncher.getPackager().setRunOptions(runOptions);
            await this.appLauncher.getPackager().start();
        }
    }

    protected showError(error: Error): void {
        void vscode.window.showErrorMessage(error.message, {
            modal: true,
        });
        // We can't print error messages via debug session logger after the session is stopped. This could break the extension work.
        if (this.debugSessionStatus === DebugSessionStatus.Stopped) {
            OutputChannelLogger.getMainChannel().error(error.message);
            return;
        }
        logger.error(error.message);
    }

    protected async terminate(): Promise<void> {
        await vscode.commands.executeCommand(this.stopCommand, undefined, {
            sessionId: this.vsCodeDebugSession.id,
        });
    }
}
