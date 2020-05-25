// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { logger } from "vscode-debugadapter";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { DebugProtocol } from "vscode-debugprotocol";
import { DirectCDPMessageHandler } from "../../cdp-proxy/CDPMessageHandlers/directCDPMessageHandler";
import { DebugSessionBase, IAttachRequestArgs, ILaunchRequestArgs } from "../debugSessionBase";
import { DebuggerEndpointHelper } from "../../cdp-proxy/debuggerEndpointHelper";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();

export class DirectDebugSession extends DebugSessionBase {

    private debuggerEndpointHelper: DebuggerEndpointHelper;
    private onDidTerminateDebugSessionHandler: vscode.Disposable;

    constructor(session: vscode.DebugSession) {
        super(session);
        this.debuggerEndpointHelper = new DebuggerEndpointHelper();

        this.onDidTerminateDebugSessionHandler = vscode.debug.onDidTerminateDebugSession(
            this.handleTerminateDebugSession.bind(this)
        );
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, launchArgs: ILaunchRequestArgs, request?: DebugProtocol.Request): Promise<void> {
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
        }))
        .catch(err => this.showError(err, response));
    }

    protected async attachRequest(response: DebugProtocol.AttachResponse, attachArgs: IAttachRequestArgs, request?: DebugProtocol.Request): Promise<void>  {
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
                            logger.log(`Connecting to ${attachArgs.port} port`);
                            return this.appLauncher.getRnCdpProxy().stopServer()
                                .then(() => this.appLauncher.getRnCdpProxy().initializeServer(new DirectCDPMessageHandler(), this.cdpProxyLogLevel))
                                .then(() => this.debuggerEndpointHelper.retryGetWSEndpoint(
                                    `http://localhost:${attachArgs.port}`,
                                    90,
                                    this.cancellationTokenSource.token
                                ))
                                .then((browserInspectUri) => {
                                    this.appLauncher.getRnCdpProxy().setBrowserInspectUri(browserInspectUri);
                                    this.establishDebugSession(resolve);
                                })
                                .catch(e => reject(e));
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
            {
                parentSession: this.session,
                consoleMode: vscode.DebugConsoleMode.MergeWithParent,
            }
        )
        .then((childDebugSessionStarted: boolean) => {
            if (childDebugSessionStarted) {
                if (resolve) {
                    resolve();
                }
            } else {
                throw new Error(localize("CouldNotStartChildDebugSession", "Couldn't start child debug session"));
            }
        },
        err => {
            throw err;
        });
    }

    private handleTerminateDebugSession(debugSession: vscode.DebugSession) {
        if (
            debugSession.configuration.rnDebugSessionId === this.session.id
            && debugSession.type === this.pwaNodeSessionName
        ) {
            this.session.customRequest(this.disconnectCommand, {forcedStop: true});
        }
    }
}
