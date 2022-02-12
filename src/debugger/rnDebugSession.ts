// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as vscode from "vscode";
import * as mkdirp from "mkdirp";
import { logger } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import * as nls from "vscode-nls";
import { ProjectVersionHelper } from "../common/projectVersionHelper";
import { TelemetryHelper } from "../common/telemetryHelper";
import { RnCDPMessageHandler } from "../cdp-proxy/CDPMessageHandlers/rnCDPMessageHandler";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { MultipleLifetimesAppWorker } from "./appWorker";
import {
    DebugSessionBase,
    DebugSessionStatus,
    IAttachRequestArgs,
    ILaunchRequestArgs,
} from "./debugSessionBase";
import { JsDebugConfigAdapter } from "./jsDebugConfigAdapter";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class RNDebugSession extends DebugSessionBase {
    private appWorker: MultipleLifetimesAppWorker | null;
    private onDidStartDebugSessionHandler: vscode.Disposable;
    private onDidTerminateDebugSessionHandler: vscode.Disposable;

    constructor(session: vscode.DebugSession) {
        super(session);

        // variables definition
        this.appWorker = null;

        this.onDidStartDebugSessionHandler = vscode.debug.onDidStartDebugSession(
            this.handleStartDebugSession.bind(this),
        );

        this.onDidTerminateDebugSessionHandler = vscode.debug.onDidTerminateDebugSession(
            this.handleTerminateDebugSession.bind(this),
        );
    }

    protected async launchRequest(
        response: DebugProtocol.LaunchResponse,
        launchArgs: ILaunchRequestArgs,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        request?: DebugProtocol.Request,
    ): Promise<void> {
        try {
            try {
                await this.initializeSettings(launchArgs);
                logger.log("Launching the application");
                logger.verbose(`Launching the application: ${JSON.stringify(launchArgs, null, 2)}`);

                await this.appLauncher.launch(launchArgs);

                if (!launchArgs.enableDebug) {
                    this.sendResponse(response);
                    // if debugging is not enabled skip attach request
                    return;
                }
            } catch (error) {
                throw ErrorHelper.getInternalError(
                    InternalErrorCode.ApplicationLaunchFailed,
                    error.message || error,
                );
            }
            // if debugging is enabled start attach request
            await this.attachRequest(response, launchArgs);
        } catch (error) {
            this.showError(error, response);
        }
    }

    protected async attachRequest(
        response: DebugProtocol.AttachResponse,
        attachArgs: IAttachRequestArgs,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        request?: DebugProtocol.Request,
    ): Promise<void> {
        let extProps = {
            platform: {
                value: attachArgs.platform,
                isPii: false,
            },
        };

        this.previousAttachArgs = attachArgs;

        return new Promise<void>(async (resolve, reject) => {
            try {
                await this.initializeSettings(attachArgs);
                logger.log("Attaching to the application");
                logger.verbose(
                    `Attaching to the application: ${JSON.stringify(attachArgs, null, 2)}`,
                );

                const versions = await ProjectVersionHelper.getReactNativeVersions(
                    this.projectRootPath,
                    ProjectVersionHelper.generateAdditionalPackagesToCheckByPlatform(attachArgs),
                );
                extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
                    attachArgs,
                    versions,
                    extProps,
                );

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                await TelemetryHelper.generate("attach", extProps, async generator => {
                    attachArgs.port =
                        attachArgs.port || this.appLauncher.getPackagerPort(attachArgs.cwd);

                    const cdpProxy = this.appLauncher.getRnCdpProxy();
                    await cdpProxy.stopServer();
                    await cdpProxy.initializeServer(
                        new RnCDPMessageHandler(),
                        this.cdpProxyLogLevel,
                        this.cancellationTokenSource.token,
                    );

                    if (attachArgs.request === "attach") {
                        await this.preparePackagerBeforeAttach(attachArgs, versions);
                    }

                    logger.log(
                        localize("StartingDebuggerAppWorker", "Starting debugger app worker."),
                    );

                    const sourcesStoragePath = path.join(this.projectRootPath, ".vscode", ".react");
                    // Create folder if not exist to avoid problems if
                    // RN project root is not a ${workspaceFolder}
                    mkdirp.sync(sourcesStoragePath);

                    // If launch is invoked first time, appWorker is undefined, so create it here
                    this.appWorker = new MultipleLifetimesAppWorker(
                        attachArgs,
                        sourcesStoragePath,
                        this.projectRootPath,
                        this.cancellationTokenSource.token,
                        undefined,
                    );
                    this.appLauncher.setAppWorker(this.appWorker);

                    this.appWorker.on("connected", (port: number) => {
                        if (this.cancellationTokenSource.token.isCancellationRequested) {
                            return this.appWorker?.stop();
                        }

                        logger.log(
                            localize(
                                "DebuggerWorkerLoadedRuntimeOnPort",
                                "Debugger worker loaded runtime on port {0}",
                                port,
                            ),
                        );

                        cdpProxy.setApplicationTargetPort(port);

                        if (this.debugSessionStatus === DebugSessionStatus.ConnectionPending) {
                            return;
                        }

                        if (this.debugSessionStatus === DebugSessionStatus.FirstConnection) {
                            this.debugSessionStatus = DebugSessionStatus.FirstConnectionPending;
                            this.establishDebugSession(attachArgs, resolve);
                        } else if (
                            this.debugSessionStatus === DebugSessionStatus.ConnectionAllowed
                        ) {
                            if (this.nodeSession) {
                                this.debugSessionStatus = DebugSessionStatus.ConnectionPending;
                                void this.nodeSession.customRequest(this.terminateCommand);
                            }
                        }
                    });

                    if (this.cancellationTokenSource.token.isCancellationRequested) {
                        return this.appWorker.stop();
                    }
                    return await this.appWorker.start();
                });
            } catch (error) {
                reject(error);
            }
        }).catch(err =>
            this.showError(
                ErrorHelper.getInternalError(
                    InternalErrorCode.CouldNotAttachToDebugger,
                    err.message || err,
                ),
                response,
            ),
        );
    }

    protected async disconnectRequest(
        response: DebugProtocol.DisconnectResponse,
        args: DebugProtocol.DisconnectArguments,
        request?: DebugProtocol.Request,
    ): Promise<void> {
        // The client is about to disconnect so first we need to stop app worker
        if (this.appWorker) {
            this.appWorker.stop();
        }

        this.onDidStartDebugSessionHandler.dispose();
        this.onDidTerminateDebugSessionHandler.dispose();

        return super.disconnectRequest(response, args, request);
    }

    protected establishDebugSession(
        attachArgs: IAttachRequestArgs,
        resolve?: (value?: void | PromiseLike<void> | undefined) => void,
    ): void {
        const attachConfiguration = JsDebugConfigAdapter.createDebuggingConfigForPureRN(
            attachArgs,
            this.appLauncher.getCdpProxyPort(),
            this.session.id,
        );

        vscode.debug
            .startDebugging(this.appLauncher.getWorkspaceFolder(), attachConfiguration, {
                parentSession: this.session,
                consoleMode: vscode.DebugConsoleMode.MergeWithParent,
            })
            .then(
                (childDebugSessionStarted: boolean) => {
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
                },
            );
    }

    private handleStartDebugSession(debugSession: vscode.DebugSession): void {
        if (
            debugSession.configuration.rnDebugSessionId === this.session.id &&
            debugSession.type === this.pwaNodeSessionName
        ) {
            this.nodeSession = debugSession;
        }
    }

    private handleTerminateDebugSession(debugSession: vscode.DebugSession): void {
        if (
            debugSession.configuration.rnDebugSessionId === this.session.id &&
            debugSession.type === this.pwaNodeSessionName
        ) {
            if (this.debugSessionStatus === DebugSessionStatus.ConnectionPending) {
                this.establishDebugSession(this.previousAttachArgs);
            } else {
                void vscode.commands.executeCommand(this.stopCommand, this.session);
            }
        }
    }

    private setConnectionAllowedIfPossible(): void {
        if (
            this.debugSessionStatus === DebugSessionStatus.ConnectionDone ||
            this.debugSessionStatus === DebugSessionStatus.ConnectionFailed
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
