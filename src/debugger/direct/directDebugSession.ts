// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { logger } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import * as nls from "vscode-nls";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { HermesCDPMessageHandler } from "../../cdp-proxy/CDPMessageHandlers/hermesCDPMessageHandler";
import {
    DebugSessionBase,
    DebugSessionStatus,
    IAttachRequestArgs,
    ILaunchRequestArgs,
} from "../debugSessionBase";
import { JsDebugConfigAdapter } from "../jsDebugConfigAdapter";
import { DebuggerEndpointHelper } from "../../cdp-proxy/debuggerEndpointHelper";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { IOSDirectCDPMessageHandler } from "../../cdp-proxy/CDPMessageHandlers/iOSDirectCDPMessageHandler";
import { PlatformType } from "../../extension/launchArgs";
import { BaseCDPMessageHandler } from "../../cdp-proxy/CDPMessageHandlers/baseCDPMessageHandler";
import { TipNotificationService } from "../../extension/services/tipsNotificationsService/tipsNotificationService";
import { RNSession } from "../debugSessionWrapper";
import { SettingsHelper } from "../../extension/settingsHelper";
import { ReactNativeProjectHelper } from "../../common/reactNativeProjectHelper";
import { IWDPHelper } from "./IWDPHelper";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class DirectDebugSession extends DebugSessionBase {
    private debuggerEndpointHelper: DebuggerEndpointHelper;
    private onDidTerminateDebugSessionHandler: vscode.Disposable;
    private onDidStartDebugSessionHandler: vscode.Disposable;
    private appTargetConnectionClosedHandlerDescriptor?: vscode.Disposable;
    private attachSession: vscode.DebugSession | null;
    private iOSWKDebugProxyHelper: IWDPHelper;

    constructor(rnSession: RNSession) {
        super(rnSession);
        this.debuggerEndpointHelper = new DebuggerEndpointHelper();
        this.iOSWKDebugProxyHelper = new IWDPHelper();
        this.attachSession = null;

        this.onDidTerminateDebugSessionHandler = vscode.debug.onDidTerminateDebugSession(
            this.handleTerminateDebugSession.bind(this),
        );

        this.onDidStartDebugSessionHandler = vscode.debug.onDidStartDebugSession(
            this.handleStartDebugSession.bind(this),
        );
    }

    protected async launchRequest(
        response: DebugProtocol.LaunchResponse,
        launchArgs: ILaunchRequestArgs,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        request?: DebugProtocol.Request,
    ): Promise<void> {
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

        void TipNotificationService.getInstance().setKnownDateForFeatureById(
            "directDebuggingWithHermes",
        );

        try {
            try {
                await ReactNativeProjectHelper.verifyMetroConfigFile(launchArgs.cwd);
                await this.initializeSettings(launchArgs);
                logger.log("Launching the application");
                logger.verbose(`Launching the application: ${JSON.stringify(launchArgs, null, 2)}`);

                const versions = await ProjectVersionHelper.getReactNativeVersions(
                    this.projectRootPath,
                    ProjectVersionHelper.generateAdditionalPackagesToCheckByPlatform(launchArgs),
                );
                extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
                    launchArgs,
                    versions,
                    extProps,
                );

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                await TelemetryHelper.generate("launch", extProps, generator =>
                    this.appLauncher.launch(launchArgs),
                );

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
            await this.vsCodeDebugSession.customRequest("attach", launchArgs);
            this.sendResponse(response);
        } catch (error) {
            this.terminateWithErrorResponse(error, response);
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
            isDirect: {
                value: true,
                isPii: false,
            },
        };

        attachArgs.webkitRangeMin = attachArgs.webkitRangeMin || 9223;
        attachArgs.webkitRangeMax = attachArgs.webkitRangeMax || 9322;

        this.previousAttachArgs = attachArgs;

        try {
            if (attachArgs.request === "attach") {
                await ReactNativeProjectHelper.verifyMetroConfigFile(attachArgs.cwd);
            }
            await this.initializeSettings(attachArgs);

            const packager = this.appLauncher.getPackager();
            const args: Parameters<typeof packager.forMessage> = [
                // message indicates that another debugger has connected
                "Already connected:",
                {
                    type: "client_log",
                    level: "warn",
                    mode: "BRIDGE",
                },
            ];

            void packager.forMessage(...args).then(
                () => {
                    this.showError(
                        ErrorHelper.getInternalError(
                            InternalErrorCode.AnotherDebuggerConnectedToPackager,
                        ),
                    );
                    void this.terminate();
                },
                () => {},
            );

            logger.log("Attaching to the application");
            logger.verbose(`Attaching to the application: ${JSON.stringify(attachArgs, null, 2)}`);

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
                const port = attachArgs.useHermesEngine
                    ? attachArgs.port || this.appLauncher.getPackagerPort(attachArgs.cwd)
                    : attachArgs.platform === PlatformType.iOS
                    ? attachArgs.port || IWDPHelper.iOS_WEBKIT_DEBUG_PROXY_DEFAULT_PORT
                    : null;
                if (port === null) {
                    throw ErrorHelper.getInternalError(
                        InternalErrorCode.CouldNotDirectDebugWithoutHermesEngine,
                        attachArgs.platform,
                    );
                }
                attachArgs.port = port;
                logger.log(`Connecting to ${attachArgs.port} port`);
                await this.appLauncher.getRnCdpProxy().stopServer();

                const cdpMessageHandler: BaseCDPMessageHandler | null = attachArgs.useHermesEngine
                    ? new HermesCDPMessageHandler()
                    : attachArgs.platform === PlatformType.iOS
                    ? new IOSDirectCDPMessageHandler()
                    : null;

                if (!cdpMessageHandler) {
                    throw ErrorHelper.getInternalError(
                        InternalErrorCode.CouldNotDirectDebugWithoutHermesEngine,
                        attachArgs.platform,
                    );
                }
                await this.appLauncher
                    .getRnCdpProxy()
                    .initializeServer(
                        cdpMessageHandler,
                        this.cdpProxyLogLevel,
                        this.cancellationTokenSource.token,
                    );

                if (!attachArgs.useHermesEngine && attachArgs.platform === PlatformType.iOS) {
                    await this.iOSWKDebugProxyHelper.startiOSWebkitDebugProxy(
                        attachArgs.port,
                        attachArgs.webkitRangeMin,
                        attachArgs.webkitRangeMax,
                    );
                    const results = await this.iOSWKDebugProxyHelper.getSimulatorProxyPort(
                        attachArgs,
                    );
                    attachArgs.port = results.targetPort;
                }

                if (attachArgs.request === "attach") {
                    await this.preparePackagerBeforeAttach(attachArgs, versions);
                }

                this.appTargetConnectionClosedHandlerDescriptor = this.appLauncher
                    .getRnCdpProxy()
                    .onApplicationTargetConnectionClosed(() => {
                        if (this.attachSession) {
                            if (
                                this.debugSessionStatus !== DebugSessionStatus.Stopping &&
                                this.debugSessionStatus !== DebugSessionStatus.Stopped
                            ) {
                                void this.terminate();
                            }
                            this.appTargetConnectionClosedHandlerDescriptor?.dispose();
                        }
                    });

                const settingsPorts = SettingsHelper.getPackagerPort(attachArgs.cwd);
                const browserInspectUri = await this.debuggerEndpointHelper.retryGetWSEndpoint(
                    `http://localhost:${attachArgs.port}`,
                    90,
                    this.cancellationTokenSource.token,
                    attachArgs.useHermesEngine,
                    settingsPorts,
                );
                this.appLauncher.getRnCdpProxy().setBrowserInspectUri(browserInspectUri);
                await this.establishDebugSession(attachArgs);
            });
            this.sendResponse(response);
        } catch (error) {
            this.terminateWithErrorResponse(
                ErrorHelper.getInternalError(
                    InternalErrorCode.CouldNotAttachToDebugger,
                    error.message || error,
                ),
                response,
            );
        }
    }

    protected async disconnectRequest(
        response: DebugProtocol.DisconnectResponse,
        args: DebugProtocol.DisconnectArguments,
        request?: DebugProtocol.Request,
    ): Promise<void> {
        this.debugSessionStatus = DebugSessionStatus.Stopping;

        this.iOSWKDebugProxyHelper.cleanUp();
        this.onDidTerminateDebugSessionHandler.dispose();
        this.onDidStartDebugSessionHandler.dispose();
        this.appLauncher.getPackager().closeWsConnection();
        this.appTargetConnectionClosedHandlerDescriptor?.dispose();
        return super.disconnectRequest(response, args, request);
    }

    protected async establishDebugSession(attachArgs: IAttachRequestArgs): Promise<void> {
        const attachConfiguration = JsDebugConfigAdapter.createDebuggingConfigForRNHermes(
            attachArgs,
            this.appLauncher.getCdpProxyPort(),
            this.rnSession.sessionId,
        );

        const childDebugSessionStarted = await vscode.debug.startDebugging(
            this.appLauncher.getWorkspaceFolder(),
            attachConfiguration,
            {
                parentSession: this.vsCodeDebugSession,
                consoleMode: vscode.DebugConsoleMode.MergeWithParent,
            },
        );
        if (!childDebugSessionStarted) {
            throw new Error(
                localize("CouldNotStartChildDebugSession", "Couldn't start child debug session"),
            );
        }
    }

    private handleTerminateDebugSession(debugSession: vscode.DebugSession): void {
        if (
            debugSession.configuration.rnDebugSessionId === this.rnSession.sessionId &&
            debugSession.type === this.pwaNodeSessionName
        ) {
            void this.terminate();
        }
    }

    private handleStartDebugSession(debugSession: vscode.DebugSession): void {
        if (
            this.nodeSession &&
            (debugSession as any).parentSession &&
            this.nodeSession.id === (debugSession as any).parentSession.id
        ) {
            this.attachSession = debugSession;
        }
        if (
            debugSession.configuration.rnDebugSessionId === this.rnSession.sessionId &&
            debugSession.type === this.pwaNodeSessionName
        ) {
            this.nodeSession = debugSession;
        }
    }

    protected async initializeSettings(args: any): Promise<any> {
        await super.initializeSettings(args);
        if (args.useHermesEngine === undefined) {
            args.useHermesEngine = true;
        }
    }
}
