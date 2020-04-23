// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import {logger } from "vscode-debugadapter";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { DebugProtocol } from "vscode-debugprotocol";
import { DirectCDPMessageHandler } from "../../cdp-proxy/CDPMessageHandlers/directCDPMessageHandler";
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

    constructor(session: vscode.DebugSession) {
        super(session);
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
                                    resolve();
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

        if (this.previousAttachArgs.platform === "android") {
            try {
                this.appLauncher.stopMonitoringLogCat();
            } catch (err) {
                logger.warn(localize("CouldNotStopMonitoringLogcat", "Couldn't stop monitoring logcat: {0}", err.message || err));
            }
        }

        super.disconnectRequest(response, args, request);
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
