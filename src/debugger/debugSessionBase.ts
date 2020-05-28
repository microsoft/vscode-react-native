// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as path from "path";
import * as fs from "fs";
import stripJsonComments = require("strip-json-comments");
import { LoggingDebugSession, Logger, logger, ErrorDestination } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { getLoggingDirectory, LogHelper } from "../extension/log/LogHelper";
import { ReactNativeProjectHelper } from "../common/reactNativeProjectHelper";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { InternalError, NestedError } from "../common/error/internalError";
import { ILaunchArgs } from "../extension/launchArgs";
import { AppLauncher } from "../extension/appLauncher";
import { LogLevel } from "../extension/log/LogHelper";
import * as nls from "vscode-nls";
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
}

export interface TerminateEventArgs {
    debugSession: vscode.DebugSession;
    args: any;
}

export interface ExtraDebugRequestArgs {
    skipFiles?: [];
    sourceMaps?: boolean;
    sourceMapPathOverrides?: { [key: string]: string };
    env?: any;
    envFile?: string;
}

export interface IAttachRequestArgs extends ExtraDebugRequestArgs, DebugProtocol.AttachRequestArguments, ILaunchArgs {
    cwd: string; /* Automatically set by VS Code to the currently opened folder */
    port: number;
    url?: string;
    address?: string;
    trace?: string;
}

export interface ILaunchRequestArgs extends DebugProtocol.LaunchRequestArguments, IAttachRequestArgs { }

export abstract class DebugSessionBase extends LoggingDebugSession {

    protected static rootSessionTerminatedEventEmitter: vscode.EventEmitter<TerminateEventArgs> = new vscode.EventEmitter<TerminateEventArgs>();
    public static readonly onDidTerminateRootDebugSession = DebugSessionBase.rootSessionTerminatedEventEmitter.event;

    protected readonly disconnectCommand: string;
    protected readonly pwaNodeSessionName: string;

    protected appLauncher: AppLauncher;
    protected projectRootPath: string;
    protected isSettingsInitialized: boolean; // used to prevent parameters reinitialization when attach is called from launch function
    protected previousAttachArgs: IAttachRequestArgs;
    protected cdpProxyLogLevel: LogLevel;
    protected debugSessionStatus: DebugSessionStatus;
    protected session: vscode.DebugSession;
    protected cancellationTokenSource: vscode.CancellationTokenSource;

    constructor(session: vscode.DebugSession) {
        super();

        // constants definition
        this.pwaNodeSessionName = "pwa-node"; // the name of node debug session created by js-debug extension
        this.disconnectCommand = "disconnect";

        // variables definition
        this.session = session;
        this.isSettingsInitialized = false;
        this.debugSessionStatus = DebugSessionStatus.FirstConnection;
        this.cancellationTokenSource = new vscode.CancellationTokenSource();
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        response.body = response.body || {};

        response.body.supportsConfigurationDoneRequest = true;
        response.body.supportsEvaluateForHovers = true;
        response.body.supportTerminateDebuggee = true;
        response.body.supportsCancelRequest = true;

        this.sendResponse(response);
    }

    protected abstract establishDebugSession(extraArgs: ExtraDebugRequestArgs, resolve?: (value?: void | PromiseLike<void> | undefined) => void): void;

    protected abstract createJsDebugDebuggingConfiguration(extraArgs: ExtraDebugRequestArgs): any;

    protected initializeSettings(args: any): Q.Promise<any> {
        if (!this.isSettingsInitialized) {
            let chromeDebugCoreLogs = getLoggingDirectory();
            if (chromeDebugCoreLogs) {
                chromeDebugCoreLogs = path.join(chromeDebugCoreLogs, "DebugSessionLogs.txt");
            }
            let logLevel: string = args.trace;
            if (logLevel) {
                logLevel = logLevel.replace(logLevel[0], logLevel[0].toUpperCase());
                logger.setup(Logger.LogLevel[logLevel], chromeDebugCoreLogs || false);
                this.cdpProxyLogLevel = LogLevel[logLevel] === LogLevel.Verbose ? LogLevel.Custom : LogLevel.None;
            } else {
                logger.setup(Logger.LogLevel.Log, chromeDebugCoreLogs || false);
                this.cdpProxyLogLevel = LogHelper.LOG_LEVEL === LogLevel.Trace ? LogLevel.Custom : LogLevel.None;
            }

            if (!args.sourceMaps) {
                args.sourceMaps = true;
            }

            const projectRootPath = getProjectRoot(args);
            return ReactNativeProjectHelper.isReactNativeProject(projectRootPath)
                .then((result) => {
                    if (!result) {
                        throw ErrorHelper.getInternalError(InternalErrorCode.NotInReactNativeFolderError);
                    }
                    this.projectRootPath = projectRootPath;
                    this.appLauncher = AppLauncher.getAppLauncherByProjectRootPath(projectRootPath);
                    this.isSettingsInitialized = true;

                    return void 0;
                });
        } else {
            return Q.resolve<void>(void 0);
        }
    }

    protected async disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): Promise<void> {
        await this.appLauncher.getRnCdpProxy().stopServer();

        this.cancellationTokenSource.cancel();
        this.cancellationTokenSource.dispose();

        // Then we tell the extension to stop monitoring the logcat, and then we disconnect the debugging session
        if (this.previousAttachArgs && this.previousAttachArgs.platform === "android") {
            try {
                this.appLauncher.stopMonitoringLogCat();
            } catch (err) {
                logger.warn(localize("CouldNotStopMonitoringLogcat", "Couldn't stop monitoring logcat: {0}", err.message || err));
            }
        }

        DebugSessionBase.rootSessionTerminatedEventEmitter.fire({
            debugSession: this.session,
            args: {
                forcedStop: (<any>args).forcedStop,
            },
        });

        this.sendResponse(response);
    }

    protected showError(error: Error, response: DebugProtocol.Response): void {

        // We can't print error messages after the debugging session is stopped. This could break the extension work.
        if ((error instanceof InternalError || error instanceof NestedError)
            && error.errorCode === InternalErrorCode.CancellationTokenTriggered
        ) {
            return;
        }

        this.sendErrorResponse(
            response,
            { format: error.message, id: 1 },
            undefined,
            undefined,
            ErrorDestination.User
        );
    }

    protected getExistingExtraArgs(extraArgs: ExtraDebugRequestArgs): any {
        let existingExtraArgs: any = {};
        if (extraArgs.env) {
            existingExtraArgs.env = extraArgs.env;
        }
        if (extraArgs.envFile) {
            existingExtraArgs.envFile = extraArgs.envFile;
        }
        if (extraArgs.sourceMaps) {
            existingExtraArgs.sourceMaps = extraArgs.sourceMaps;
        }
        if (extraArgs.sourceMapPathOverrides) {
            existingExtraArgs.sourceMapPathOverrides = extraArgs.sourceMapPathOverrides;
        }
        if (extraArgs.skipFiles) {
            existingExtraArgs.skipFiles = extraArgs.skipFiles;
        }

        return existingExtraArgs;
    }
}

/**
 * Parses settings.json file for workspace root property
 */
export function getProjectRoot(args: any): string {
    const vsCodeRoot = args.cwd ? path.resolve(args.cwd) : path.resolve(args.program, "../..");
    const settingsPath = path.resolve(vsCodeRoot, ".vscode/settings.json");
    try {
        let settingsContent = fs.readFileSync(settingsPath, "utf8");
        settingsContent = stripJsonComments(settingsContent);
        let parsedSettings = JSON.parse(settingsContent);
        let projectRootPath = parsedSettings["react-native-tools.projectRoot"] || parsedSettings["react-native-tools"].projectRoot;
        return path.resolve(vsCodeRoot, projectRootPath);
    } catch (e) {
        logger.verbose(`${settingsPath} file doesn't exist or its content is incorrect. This file will be ignored.`);
        return args.cwd ? path.resolve(args.cwd) : path.resolve(args.program, "../..");
    }
}
