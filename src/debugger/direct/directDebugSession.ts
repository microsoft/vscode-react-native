// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import {logger } from "vscode-debugadapter";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { DebugProtocol } from "vscode-debugprotocol";
import { DirectCDPMessageHandler } from "../../cdp-proxy/CDPMessageHandlers/directCDPMessageHandler";
import { DebugSessionStatus } from "../debugSessionBase";
import { DebugSessionBase, IAttachRequestArgs, ILaunchRequestArgs } from "../debugSessionBase";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();

export class DirectDebugSession extends DebugSessionBase {

    /**
     * @description The Hermes native functions calls mark in call stack
     * @type {string}
     */
    // private static HERMES_NATIVE_FUNCTION_NAME: string = "(native)";

    /**
     * @description Equals to 0xfffffff - the scriptId returned by Hermes debugger, that means "invalid script ID"
     * @type {string}
     */
    // private static HERMES_NATIVE_FUNCTION_SCRIPT_ID: string = "4294967295";

    private readonly terminateCommand: string;
    private readonly pwaNodeSessionName: string;

    private nodeSession: vscode.DebugSession | null;
    private onDidStartDebugSessionHandler: vscode.Disposable;
    private onDidTerminateDebugSessionHandler: vscode.Disposable;

    constructor(session: vscode.DebugSession) {
        super(session);

        // constants definition
        this.terminateCommand = "terminate"; // the "terminate" command is sent from the client to the debug adapter in order to give the debuggee a chance for terminating itself
        this.pwaNodeSessionName = "pwa-node"; // the name of node debug session created by js-debug extension

        // variables definition
        this.onDidStartDebugSessionHandler = vscode.debug.onDidStartDebugSession(
            this.handleStartDebugSession.bind(this)
        );

        this.onDidTerminateDebugSessionHandler = vscode.debug.onDidTerminateDebugSession(
            this.handleTerminateDebugSession.bind(this)
        );
    }

    protected launchRequest(response: DebugProtocol.LaunchResponse, launchArgs: ILaunchRequestArgs, request?: DebugProtocol.Request): Promise<void> {
        let extProps = {
            platform: {
                value: launchArgs.platform,
                isPii: false,
            },
            isDirect: {
                value: true,
                isPii: false,
            },
        };

        return new Promise<void>((resolve, reject) => this.initializeSettings(launchArgs)
            .then(() => {
                logger.log("Launching the application");
                logger.verbose(`Launching the application: ${JSON.stringify(launchArgs, null , 2)}`);
                return ProjectVersionHelper.getReactNativeVersions(launchArgs.cwd, launchArgs.platform === "windows")
                    .then(versions => {
                        extProps = TelemetryHelper.addPropertyToTelemetryProperties(versions.reactNativeVersion, "reactNativeVersion", extProps);
                        if (launchArgs.platform === "windows") {
                            extProps = TelemetryHelper.addPropertyToTelemetryProperties(versions.reactNativeWindowsVersion, "reactNativeWindowsVersion", extProps);
                        }
                        return TelemetryHelper.generate("launch", extProps, (generator) => {
                            return this.appLauncher.launch(launchArgs)
                                .then(() => {
                                    return this.appLauncher.getPackagerPort(launchArgs.cwd);
                                })
                                .then((packagerPort: number) => {
                                    launchArgs.port = launchArgs.port || packagerPort;
                                    this.attachRequest(response, launchArgs).then(() => {
                                        resolve();
                                    }).catch((e) => reject(e));
                                }).catch((e) => reject(e));
                        })
                        .catch((err) => {
                            logger.error("An error occurred while launching the application. " + err.message || err);
                            reject(err);
                        });
                    });
        }));
    }

    protected attachRequest(response: DebugProtocol.AttachResponse, attachArgs: IAttachRequestArgs, request?: DebugProtocol.Request): Promise<void>  {
        let extProps = {
            platform: {
                value: attachArgs.platform,
                isPii: false,
            },
            isDirect: {
                value: true,
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
                            attachArgs.port = attachArgs.port || this.appLauncher.getPackagerPort(attachArgs.cwd);
                            this.appLauncher.getRnCdpProxy().stopServer();
                            logger.log(`Connecting to ${attachArgs.port} port`);
                            return this.appLauncher.getRnCdpProxy().initializeServer(new DirectCDPMessageHandler(), this.cdpProxyLogLevel)
                                .then(() => {
                                    this.appLauncher.getRnCdpProxy().setApplicationTargetPort(attachArgs.port);

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

        this.appLauncher.getRnCdpProxy().stopServer();

        this.onDidStartDebugSessionHandler.dispose();
        this.onDidTerminateDebugSessionHandler.dispose();

        if (this.previousAttachArgs.platform === "android") {
            try {
                this.appLauncher.stopMonitoringLogCat();
            } catch (err) {
                logger.warn(localize("CouldNotStopMonitoringLogcat", "Couldn't stop monitoring logcat: {0}", err.message || err));
            }
        }

        super.disconnectRequest(response, args, request);
    }

    protected establishDebugSession(resolve?: (value?: void | PromiseLike<void> | undefined) => void): void {
        const attachArguments = {
            type: "pwa-node",
            request: "attach",
            name: "Attach",
            continueOnAttach: true,
            port: this.appLauncher.getCdpProxyPort(),
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

    /*protected async onPaused(notification: Crdp.Debugger.PausedEvent, expectingStopReason = this._expectingStopReason): Promise<IOnPausedResult> {
        // Excluding Hermes native function calls from call stack, since VS Code can't process them properly
        // More info: https://github.com/facebook/hermes/issues/168
        notification.callFrames = notification.callFrames.filter(callFrame =>
            callFrame.functionName !== DirectDebugAdapter.HERMES_NATIVE_FUNCTION_NAME &&
            callFrame.location.scriptId !== DirectDebugAdapter.HERMES_NATIVE_FUNCTION_SCRIPT_ID
            );
        return super.onPaused(notification, expectingStopReason);
    }*/
}
