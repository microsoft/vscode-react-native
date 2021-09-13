// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { logger } from "vscode-debugadapter";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { DebugProtocol } from "vscode-debugprotocol";
import { HermesCDPMessageHandler } from "../../cdp-proxy/CDPMessageHandlers/hermesCDPMessageHandler";
import { DebugSessionBase, IAttachRequestArgs, ILaunchRequestArgs } from "../debugSessionBase";
import { JsDebugConfigAdapter } from "../jsDebugConfigAdapter";
import { DebuggerEndpointHelper } from "../../cdp-proxy/debuggerEndpointHelper";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import * as nls from "vscode-nls";
import { IOSDirectCDPMessageHandler } from "../../cdp-proxy/CDPMessageHandlers/iOSDirectCDPMessageHandler";
import { PlatformType } from "../../extension/launchArgs";
import { IWDPHelper } from "./IWDPHelper";
import { BaseCDPMessageHandler } from "../../cdp-proxy/CDPMessageHandlers/baseCDPMessageHandler";
import { TipNotificationService } from "../../extension/tipsNotificationsService/tipsNotificationService";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class DirectDebugSession extends DebugSessionBase {
    private debuggerEndpointHelper: DebuggerEndpointHelper;
    private onDidTerminateDebugSessionHandler: vscode.Disposable;
    private iOSWKDebugProxyHelper: IWDPHelper;

    constructor(session: vscode.DebugSession) {
        super(session);
        this.debuggerEndpointHelper = new DebuggerEndpointHelper();
        this.iOSWKDebugProxyHelper = new IWDPHelper();

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

        TipNotificationService.getInstance().setKnownDateForFeatureById(
            "directDebuggingWithHermes",
        );

        try {
            try {
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
            isDirect: {
                value: true,
                isPii: false,
            },
        };

        attachArgs.webkitRangeMin = attachArgs.webkitRangeMin || 9223;
        attachArgs.webkitRangeMax = attachArgs.webkitRangeMax || 9322;

        this.previousAttachArgs = attachArgs;

        try {
            await this.initializeSettings(attachArgs);
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

                const cdpProxy: BaseCDPMessageHandler | null = attachArgs.useHermesEngine
                    ? new HermesCDPMessageHandler()
                    : attachArgs.platform === PlatformType.iOS
                    ? new IOSDirectCDPMessageHandler()
                    : null;

                if (!cdpProxy) {
                    throw ErrorHelper.getInternalError(
                        InternalErrorCode.CouldNotDirectDebugWithoutHermesEngine,
                        attachArgs.platform,
                    );
                }
                await this.appLauncher
                    .getRnCdpProxy()
                    .initializeServer(cdpProxy, this.cdpProxyLogLevel);

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

                await this.appLauncher.getPackager().start();

                const browserInspectUri = await this.debuggerEndpointHelper.retryGetWSEndpoint(
                    `http://localhost:${attachArgs.port}`,
                    90,
                    this.cancellationTokenSource.token,
                );
                this.appLauncher.getRnCdpProxy().setBrowserInspectUri(browserInspectUri);
                await this.establishDebugSession(attachArgs);
            });
        } catch (error) {
            this.showError(
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
        this.iOSWKDebugProxyHelper.cleanUp();
        this.onDidTerminateDebugSessionHandler.dispose();
        super.disconnectRequest(response, args, request);
    }

    protected async establishDebugSession(attachArgs: IAttachRequestArgs): Promise<void> {
        const attachConfiguration = JsDebugConfigAdapter.createDebuggingConfigForRNHermes(
            attachArgs,
            this.appLauncher.getCdpProxyPort(),
            this.session.id,
        );

        const childDebugSessionStarted = await vscode.debug.startDebugging(
            this.appLauncher.getWorkspaceFolder(),
            attachConfiguration,
            {
                parentSession: this.session,
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
            debugSession.configuration.rnDebugSessionId === this.session.id &&
            debugSession.type === this.pwaNodeSessionName
        ) {
            vscode.commands.executeCommand(this.stopCommand, this.session);
        }
    }

    protected async initializeSettings(args: any): Promise<any> {
        await super.initializeSettings(args);
        if (args.useHermesEngine === undefined) {
            args.useHermesEngine = true;
        }
    }
}
