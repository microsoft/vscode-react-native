// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as path from "path";
import * as fs from "fs";
import * as mkdirp from "mkdirp";
import stripJsonComments = require("strip-json-comments");
import { LoggingDebugSession, Logger, logger } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { getLoggingDirectory, LogHelper } from "../extension/log/LogHelper";
import { ReactNativeProjectHelper } from "../common/reactNativeProjectHelper";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { ILaunchArgs } from "../extension/launchArgs";
import { ProjectVersionHelper } from "../common/projectVersionHelper";
import { TelemetryHelper } from "../common/telemetryHelper";
import { AppLauncher } from "../extension/appLauncher";
import { MultipleLifetimesAppWorker } from "./appWorker";
import { ReactNativeCDPProxy } from "../cdp-proxy/reactNativeCDPProxy";
import { generateRandomPortNumber } from "../common/extensionHelper";
import { LogLevel } from "../extension/log/LogHelper";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();

enum DebugSessionStatus {
    FirstConnection,
    FirstConnectionPending,
    ConnectionAllowed,
    ConnectionPending,
    ConnectionDone,
    ConnectionFailed,
}

export interface IAttachRequestArgs extends DebugProtocol.AttachRequestArguments, ILaunchArgs {
    cwd: string; /* Automatically set by VS Code to the currently opened folder */
    port: number;
    url?: string;
    address?: string;
    trace?: string;
}

export interface ILaunchRequestArgs extends DebugProtocol.LaunchRequestArguments, IAttachRequestArgs { }

export class RNDebugSession extends LoggingDebugSession {

    private readonly cdpProxyPort: number;
    private readonly cdpProxyHostAddress: string;
    private readonly terminateCommand: string;
    private readonly pwaNodeSessionName: string;

    private appLauncher: AppLauncher;
    private appWorker: MultipleLifetimesAppWorker | null;
    private projectRootPath: string;
    private isSettingsInitialized: boolean; // used to prevent parameters reinitialization when attach is called from launch function
    private previousAttachArgs: IAttachRequestArgs;
    private rnCdpProxy: ReactNativeCDPProxy | null;
    private cdpProxyLogLevel: LogLevel;
    private nodeSession: vscode.DebugSession | null;
    private debugSessionStatus: DebugSessionStatus;

    constructor(private session: vscode.DebugSession) {
        super();

        // constants definition
        this.cdpProxyPort = generateRandomPortNumber();
        this.cdpProxyHostAddress = "127.0.0.1"; // localhost
        this.terminateCommand = "terminate"; // the "terminate" command is sent from the client to the debug adapter in order to give the debuggee a chance for terminating itself
        this.pwaNodeSessionName = "pwa-node"; // the name of node debug session created by js-debug extension

        // variables definition
        this.isSettingsInitialized = false;
        this.appWorker = null;
        this.rnCdpProxy = null;
        this.debugSessionStatus = DebugSessionStatus.FirstConnection;

        vscode.debug.onDidStartDebugSession(
            this.handleStartDebugSession.bind(this)
        );

        vscode.debug.onDidTerminateDebugSession(
            this.handleTerminateDebugSession.bind(this)
        );
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        super.initializeRequest(response, args);
    }

    protected launchRequest(response: DebugProtocol.LaunchResponse, launchArgs: ILaunchRequestArgs, request?: DebugProtocol.Request): Promise<void> {
        return new Promise<void>((resolve, reject) => this.initializeSettings(launchArgs)
            .then(() => {
                logger.log("Launching the application");
                logger.verbose(`Launching the application: ${JSON.stringify(launchArgs, null , 2)}`);

                this.appLauncher.launch(launchArgs)
                    .then(() => {
                        return this.appLauncher.getPackagerPort(launchArgs.cwd);
                    })
                    .then((packagerPort: number) => {
                        launchArgs.port = launchArgs.port || packagerPort;
                        this.attachRequest(response, launchArgs).then(() => {
                            resolve();
                        }).catch((e) => reject(e));
                    })
                    .catch((err) => {
                        logger.error("An error occurred while attaching to the debugger. " + err.message || err);
                        reject(err);
                    });
            }));
    }

    protected attachRequest(response: DebugProtocol.AttachResponse, attachArgs: IAttachRequestArgs, request?: DebugProtocol.Request): Promise<void>  {
        let extProps = {
            platform: {
                value: attachArgs.platform,
                isPii: false,
            },
        };

        this.previousAttachArgs = attachArgs;
        return new Promise<void>((resolve, reject) => this.initializeSettings(attachArgs)
            .then(() => {
                logger.log("Attaching to the application");
                logger.verbose(`Attaching to the application: ${JSON.stringify(attachArgs, null , 2)}`);
                return ProjectVersionHelper.getReactNativeVersions(attachArgs.cwd, true)
                    .then(versions => {
                        extProps = TelemetryHelper.addPropertyToTelemetryProperties(versions.reactNativeVersion, "reactNativeVersion", extProps);
                        if (!ProjectVersionHelper.isVersionError(versions.reactNativeWindowsVersion)) {
                            extProps = TelemetryHelper.addPropertyToTelemetryProperties(versions.reactNativeWindowsVersion, "reactNativeWindowsVersion", extProps);
                        }
                        return TelemetryHelper.generate("attach", extProps, (generator) => {
                            this.rnCdpProxy = new ReactNativeCDPProxy(
                                this.cdpProxyHostAddress,
                                this.cdpProxyPort,
                                this.cdpProxyLogLevel
                            );
                            attachArgs.port = attachArgs.port || this.appLauncher.getPackagerPort(attachArgs.cwd);
                            return this.rnCdpProxy.createServer()
                                .then(() => {
                                    logger.log(localize("StartingDebuggerAppWorker", "Starting debugger app worker."));

                                    const sourcesStoragePath = path.join(this.projectRootPath, ".vscode", ".react");
                                    // Create folder if not exist to avoid problems if
                                    // RN project root is not a ${workspaceFolder}
                                    mkdirp.sync(sourcesStoragePath);

                                    // If launch is invoked first time, appWorker is undefined, so create it here
                                    this.appWorker = new MultipleLifetimesAppWorker(
                                        attachArgs,
                                        sourcesStoragePath,
                                        this.projectRootPath,
                                        undefined
                                        );
                                    this.appLauncher.setAppWorker(this.appWorker);

                                    this.appWorker.on("connected", (port: number) => {
                                        logger.log(localize("DebuggerWorkerLoadedRuntimeOnPort", "Debugger worker loaded runtime on port {0}", port));

                                        if (this.rnCdpProxy) {
                                            this.rnCdpProxy.setApplicationTargetPort(port);
                                        }

                                        if (this.debugSessionStatus === DebugSessionStatus.ConnectionPending) {
                                            return;
                                        }

                                        if (this.debugSessionStatus === DebugSessionStatus.FirstConnection) {
                                            this.debugSessionStatus = DebugSessionStatus.FirstConnectionPending;
                                            this.establishDebugSession(resolve);
                                        } else if (this.debugSessionStatus === DebugSessionStatus.ConnectionAllowed) {
                                            if (this.nodeSession) {
                                                this.debugSessionStatus = DebugSessionStatus.ConnectionPending;
                                                this.nodeSession.customRequest(this.terminateCommand);
                                            }
                                        }
                                    });
                                    return this.appWorker.start();
                                });
                        })
                        .catch((err) => {
                            logger.error("An error occurred while attaching to the debugger. " + err.message || err);
                            reject(err);
                        });
                    });
        }));
    }

    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void {
        // The client is about to disconnect so first we need to stop app worker
        if (this.appWorker) {
            this.appWorker.stop();
        }

        if (this.rnCdpProxy) {
            this.rnCdpProxy.stopServer();
            this.rnCdpProxy = null;
        }

        // Then we tell the extension to stop monitoring the logcat, and then we disconnect the debugging session
        if (this.previousAttachArgs.platform === "android") {
            try {
                this.appLauncher.stopMonitoringLogCat();
            } catch (err) {
                logger.warn(localize("CouldNotStopMonitoringLogcat", "Couldn't stop monitoring logcat: {0}", err.message || err));
            }
        }

        super.disconnectRequest(response, args, request);
    }

    private establishDebugSession(resolve?: (value?: void | PromiseLike<void> | undefined) => void): void {
        if (this.rnCdpProxy) {
            const attachArguments = {
                type: "pwa-node",
                request: "attach",
                name: "Attach",
                continueOnAttach: true,
                port: this.cdpProxyPort,
                smartStep: false,
                // The unique identifier of the debug session. It is used to distinguish React Native extension's
                // debug sessions from other ones. So we can save and process only the extension's debug sessions
                // in vscode.debug API methods "onDidStartDebugSession" and "onDidTerminateDebugSession".
                rnDebugSessionId: this.session.id,
            };

            vscode.debug.startDebugging(
                this.appLauncher.getWorkspaceFolder(),
                attachArguments,
                this.session
            )
            .then((childDebugSessionStarted: boolean) => {
                if (childDebugSessionStarted) {
                    this.debugSessionStatus = DebugSessionStatus.ConnectionDone;
                    this.setConnectionAllowedIfPossible();
                    if (resolve) {
                        this.debugSessionStatus = DebugSessionStatus.ConnectionAllowed;
                        resolve();
                    }
                } else {
                    this.debugSessionStatus = DebugSessionStatus.ConnectionFailed;
                    this.setConnectionAllowedIfPossible();
                    this.resetFirstConnectionStatus();
                    throw new Error("Cannot start child debug session");
                }
            },
            err => {
                this.debugSessionStatus = DebugSessionStatus.ConnectionFailed;
                this.setConnectionAllowedIfPossible();
                this.resetFirstConnectionStatus();
                throw err;
            });
        } else {
            this.resetFirstConnectionStatus();
            throw new Error("Cannot connect to debugger worker: Chrome debugger proxy is offline");
        }
    }

    private initializeSettings(args: any): Q.Promise<any> {
        if (!this.isSettingsInitialized) {
            let chromeDebugCoreLogs = getLoggingDirectory();
            if (chromeDebugCoreLogs) {
                chromeDebugCoreLogs = path.join(chromeDebugCoreLogs, "ChromeDebugCoreLogs.txt");
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

    private handleStartDebugSession(debugSession: vscode.DebugSession) {
        if (
            debugSession.configuration.rnDebugSessionId === this.session.id
            && debugSession.type === this.pwaNodeSessionName
        ) {
            this.nodeSession = debugSession;
        }
    }

    private handleTerminateDebugSession(debugSession: vscode.DebugSession) {
        if (
            debugSession.configuration.rnDebugSessionId === this.session.id
            && this.debugSessionStatus === DebugSessionStatus.ConnectionPending
            && debugSession.type === this.pwaNodeSessionName
        ) {
            this.establishDebugSession();
        }
    }

    private setConnectionAllowedIfPossible(): void {
        if (
            this.debugSessionStatus === DebugSessionStatus.ConnectionDone
            || this.debugSessionStatus === DebugSessionStatus.ConnectionFailed
        ) {
            this.debugSessionStatus = DebugSessionStatus.ConnectionAllowed;
        }
    }

    private resetFirstConnectionStatus(): void {
        if (this.debugSessionStatus === DebugSessionStatus.FirstConnectionPending) {
            this.debugSessionStatus = DebugSessionStatus.FirstConnection;
        }
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
