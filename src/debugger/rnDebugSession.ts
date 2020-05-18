// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as path from "path";
import * as mkdirp from "mkdirp";
import { logger } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { ProjectVersionHelper } from "../common/projectVersionHelper";
import { TelemetryHelper } from "../common/telemetryHelper";
import { MultipleLifetimesAppWorker } from "./appWorker";
import { RnCDPMessageHandler } from "../cdp-proxy/CDPMessageHandlers/rnCDPMessageHandler";
import { DebugSessionBase, DebugSessionStatus, IAttachRequestArgs, ILaunchRequestArgs } from "./debugSessionBase";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();

export class RNDebugSession extends DebugSessionBase {

    private readonly terminateCommand: string;
    private readonly pwaNodeSessionName: string;

    private appWorker: MultipleLifetimesAppWorker | null;
    private nodeSession: vscode.DebugSession | null;
    private onDidStartDebugSessionHandler: vscode.Disposable;
    private onDidTerminateDebugSessionHandler: vscode.Disposable;

    constructor(session: vscode.DebugSession) {
        super(session);

        // constants definition
        this.terminateCommand = "terminate"; // the "terminate" command is sent from the client to the debug adapter in order to give the debuggee a chance for terminating itself
        this.pwaNodeSessionName = "pwa-node"; // the name of node debug session created by js-debug extension

        // variables definition
        this.appWorker = null;

        this.onDidStartDebugSessionHandler = vscode.debug.onDidStartDebugSession(
            this.handleStartDebugSession.bind(this)
        );

        this.onDidTerminateDebugSessionHandler = vscode.debug.onDidTerminateDebugSession(
            this.handleTerminateDebugSession.bind(this)
        );
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, launchArgs: ILaunchRequestArgs, request?: DebugProtocol.Request): Promise<void> {
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
                        logger.error("An error occurred while launching the application. " + err.message || err);
                        reject(err);
                    });
            }))
            .catch(err => this.showError(err, response));
    }

    protected async attachRequest(response: DebugProtocol.AttachResponse, attachArgs: IAttachRequestArgs, request?: DebugProtocol.Request): Promise<void>  {
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
                            attachArgs.port = attachArgs.port || this.appLauncher.getPackagerPort(attachArgs.cwd);
                            return this.appLauncher.getRnCdpProxy().stopServer()
                                .then(() => this.appLauncher.getRnCdpProxy().initializeServer(new RnCDPMessageHandler(), this.cdpProxyLogLevel))
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

                                        this.appLauncher.getRnCdpProxy().setApplicationTargetPort(port);

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
        }))
        .catch(err => this.showError(err, response));
    }

    protected async disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): Promise<void> {
        // The client is about to disconnect so first we need to stop app worker
        if (this.appWorker) {
            this.appWorker.stop();
        }

        this.onDidStartDebugSessionHandler.dispose();
        this.onDidTerminateDebugSessionHandler.dispose();

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
