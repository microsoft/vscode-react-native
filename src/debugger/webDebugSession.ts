// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as nls from "vscode-nls";
import * as vscode from "vscode";
import * as path from "path";
import {
    ErrorDestination,
    logger,
    Logger,
    LoggingDebugSession,
    OutputEvent,
} from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import BrowserPlatform from "../extension/browser/browserPlatform";
import { PromiseUtil } from "../common/node/promise";
import { JsDebugConfigAdapter } from "./jsDebugConfigAdapter";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export enum TargetType {
    Emulator = "emulator",
    Device = "device",
    Chrome = "chrome",
    Edge = "edge",
}

export enum PwaDebugType {
    Node = "pwa-node",
    Chrome = "pwa-chrome",
}

export enum PlatformType {
    Android = "android",
    IOS = "ios",
    Windows = "windows",
    Serve = "serve",
    AmazonFireos = "amazon_fireos",
    Blackberry10 = "blackberry10",
    Firefoxos = "firefoxos",
    Ubuntu = "ubuntu",
    Wp8 = "wp8",
    Browser = "browser",
}

/**
 * Enum of possible statuses of debug session
 */
export enum DebugSessionStatus {
    /** The session is active */
    Active,
    /** The session is processing attachment after failed attempt */
    Reattaching,
    /** Debugger attached to the app */
    Attached,
    /** The session is handling disconnect request now */
    Stopping,
    /** The session is stopped */
    Stopped,
    /** Failed to attach to the app */
    AttachFailed,
}

export type DebugConsoleLogger = (message: string, error?: boolean | string) => void;

export interface WebviewData {
    devtoolsFrontendUrl: string;
    title: string;
    url: string;
    webSocketDebuggerUrl: string;
}

export default class CordovaDebugSession extends LoggingDebugSession {
    public static readonly CANCELLATION_ERROR_NAME = "tokenCanceled";
    private static readonly STOP_COMMAND = "workbench.action.debug.stop"; // the command which simulates a click on the "Stop" button
    private static readonly CDP_PROXY_HOST_ADDRESS = "127.0.0.1"; // localhost
    private static CDP_PROXY_PORT: number;

    private readonly pwaSessionName: PwaDebugType;

    private isTelemetryInitialized: boolean = false;
    private isSettingsInitialized: boolean = false; // used to prevent parameters re-initialization when attach is called from launch function
    private attachedDeferred: PromiseUtil = new PromiseUtil();

    private workspaceManager: CordovaWorkspaceManager;
    private cordovaCdpProxy: CordovaCDPProxy | null;
    private vsCodeDebugSession: vscode.DebugSession;
    private platform: AbstractPlatform | undefined;
    private onDidTerminateDebugSessionHandler: vscode.Disposable;
    private jsDebugConfigAdapter: JsDebugConfigAdapter = new JsDebugConfigAdapter();
    private debugSessionStatus: DebugSessionStatus = DebugSessionStatus.Active;
    private cdpProxyErrorHandlerDescriptor?: vscode.Disposable;
    private attachRetryCount: number = 2;

    private cdpProxyLogLevel: LogLevel;
    private cancellationTokenSource: vscode.CancellationTokenSource =
        new vscode.CancellationTokenSource();
    private outputLogger: DebugConsoleLogger = (message: string, error?: boolean | string) => {
        let category = "console";
        if (error === true) {
            category = "stderr";
        }
        if (typeof error === "string") {
            category = error;
        }

        let newLine = "\n";
        if (category === "stdout" || category === "stderr") {
            newLine = "";
        }
        this.sendEvent(new OutputEvent(message + newLine, category));
    };

    constructor(
        private cordovaSession: CordovaSession,
        private sessionManager: CordovaSessionManager,
    ) {
        super();
        CordovaDebugSession.CDP_PROXY_PORT = generateRandomPortNumber();
        this.vsCodeDebugSession = cordovaSession.getVSCodeDebugSession();
        if (
            this.vsCodeDebugSession.configuration.platform === PlatformType.IOS &&
            !SimulateHelper.isSimulate({
                target: this.vsCodeDebugSession.configuration.target,
                simulatePort: this.vsCodeDebugSession.configuration.simulatePort,
            })
        ) {
            this.pwaSessionName = PwaDebugType.Node; // the name of Node debug session created by js-debug extension
        } else {
            this.pwaSessionName = PwaDebugType.Chrome; // the name of Chrome debug session created by js-debug extension
        }
        this.onDidTerminateDebugSessionHandler = vscode.debug.onDidTerminateDebugSession(
            this.handleTerminateDebugSession.bind(this),
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async launchRequest(
        response: DebugProtocol.LaunchResponse,
        launchArgs: ICordovaLaunchRequestArgs,
        request?: DebugProtocol.Request,
    ): Promise<void> {
        try {
            if (isNullOrUndefined(launchArgs.cwd)) {
                throw ErrorHelper.getInternalError(InternalErrorCode.CwdUndefined);
            }
            await this.initializeTelemetry(launchArgs.cwd);
            await this.initializeSettings(launchArgs);
            this.platform = await this.resolvePlatform(launchArgs);

            if (this.platform instanceof AbstractMobilePlatform) {
                await this.resolveAndSaveMobileTarget(this.platform, launchArgs);
            }

            await TelemetryHelper.generate("launch", async generator => {
                TelemetryHelper.sendPluginsList(
                    launchArgs.cwd,
                    CordovaProjectHelper.getInstalledPlugins(launchArgs.cwd),
                );
                generator.add(
                    "target",
                    CordovaDebugSession.getTargetType(launchArgs.target),
                    false,
                );
                generator.add(
                    "projectType",
                    TelemetryHelper.prepareProjectTypesTelemetry(
                        this.platform.getPlatformOpts().projectType,
                    ),
                    false,
                );
                generator.add("platform", launchArgs.platform, false);
                this.outputLogger(
                    localize(
                        "LaunchingForPlatform",
                        "Launching for {0} (This may take a while)...",
                        launchArgs.platform,
                    ),
                );

                const launchResult = await this.platform.launchApp();
                Object.assign(launchArgs, launchResult);

                await this.vsCodeDebugSession.customRequest("attach", launchArgs);

                this.sendResponse(response);
                this.cordovaSession.setStatus(CordovaSessionStatus.Activated);
            });
        } catch (error) {
            this.outputLogger(error.message || error, true);
            await this.cleanUp();
            this.terminateWithErrorResponse(error, response);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async attachRequest(
        response: DebugProtocol.AttachResponse,
        attachArgs: ICordovaAttachRequestArgs,
        request?: DebugProtocol.Request,
    ): Promise<void> {
        const doAttach = async (attachArgs: ICordovaAttachRequestArgs) => {
            try {
                await this.initializeTelemetry(attachArgs.cwd);
                await this.initializeSettings(attachArgs);
                attachArgs.port = attachArgs.port || 9222;
                if (!this.platform) {
                    this.platform = await this.resolvePlatform(attachArgs);
                }
                if (this.platform instanceof AbstractMobilePlatform && !this.platform.target) {
                    await this.resolveAndSaveMobileTarget(this.platform, attachArgs, true);
                }
                const projectType = this.platform.getPlatformOpts().projectType;

                await TelemetryHelper.generate("attach", async generator => {
                    TelemetryHelper.sendPluginsList(
                        attachArgs.cwd,
                        CordovaProjectHelper.getInstalledPlugins(attachArgs.cwd),
                    );
                    generator.add(
                        "target",
                        CordovaDebugSession.getTargetType(attachArgs.target),
                        false,
                    );
                    generator.add(
                        "projectType",
                        TelemetryHelper.prepareProjectTypesTelemetry(projectType),
                        false,
                    );
                    generator.add("platform", attachArgs.platform, false);

                    const sourcemapPathTransformer = new SourcemapPathTransformer(
                        attachArgs.cwd,
                        attachArgs.platform,
                        projectType,
                        attachArgs.request,
                        attachArgs.ionicLiveReload,
                        attachArgs.address,
                    );
                    this.cordovaCdpProxy = new CordovaCDPProxy(
                        CordovaDebugSession.CDP_PROXY_HOST_ADDRESS,
                        CordovaDebugSession.CDP_PROXY_PORT,
                        sourcemapPathTransformer,
                        projectType,
                        attachArgs,
                    );
                    this.cordovaCdpProxy.setApplicationTargetPort(attachArgs.port);
                    await this.cordovaCdpProxy.createServer(
                        this.cdpProxyLogLevel,
                        this.cancellationTokenSource.token,
                    );

                    this.outputLogger(
                        localize("AttachingToPlatform", "Attaching to {0}", attachArgs.platform),
                    );
                    const attachResult = await this.platform.prepareForAttach();
                    this.outputLogger(localize("AttachingToApp", "Attaching to app"));
                    this.outputLogger("", true); // Send blank message on stderr to include a divider between prelude and app starting
                    const processedAttachArgs = Object.assign({}, attachArgs, attachResult);
                    if (processedAttachArgs.webSocketDebuggerUrl) {
                        this.cordovaCdpProxy.setBrowserInspectUri(
                            processedAttachArgs.webSocketDebuggerUrl,
                        );
                    }
                    this.cordovaCdpProxy.configureCDPMessageHandlerAccordingToProcessedAttachArgs(
                        processedAttachArgs,
                    );
                    this.cdpProxyErrorHandlerDescriptor = this.cordovaCdpProxy.onError(
                        async (err: Error) => {
                            if (this.attachRetryCount > 0) {
                                this.debugSessionStatus = DebugSessionStatus.Reattaching;
                                this.attachRetryCount--;
                                await this.attachmentCleanUp();
                                this.outputLogger(
                                    localize(
                                        "ReattachingToApp",
                                        "Failed attempt to attach to the app. Trying to reattach...",
                                    ),
                                );
                                void doAttach(attachArgs);
                            } else {
                                this.showError(err);
                                this.terminate();
                                this.cdpProxyErrorHandlerDescriptor?.dispose();
                            }
                        },
                    );
                    await this.establishDebugSession(processedAttachArgs);

                    this.debugSessionStatus = DebugSessionStatus.Attached;
                });
            } catch (error) {
                this.outputLogger(error.message || error, true);
                this.debugSessionStatus = DebugSessionStatus.AttachFailed;
                throw error;
            }
        };

        try {
            await doAttach(attachArgs);
            this.attachedDeferred.resolve();
            this.sendResponse(response);
            this.cordovaSession.setStatus(CordovaSessionStatus.Activated);
        } catch (error) {
            try {
                await this.cleanUp();
            } finally {
                this.terminateWithErrorResponse(error, response);
            }
        }
    }

    protected async disconnectRequest(
        response: DebugProtocol.DisconnectResponse,
        args: DebugProtocol.DisconnectArguments,
        request?: DebugProtocol.Request,
    ): Promise<void> {
        await this.cleanUp(args.restart);
        this.debugSessionStatus = DebugSessionStatus.Stopped;
        super.disconnectRequest(response, args, request);
    }

    private async resolveAndSaveMobileTarget(
        mobilePlatform: AbstractMobilePlatform,
        args: ICordovaLaunchRequestArgs | ICordovaAttachRequestArgs,
        isAttachRequest: boolean = false,
    ): Promise<void> {
        if (args.target && !(await mobilePlatform.getTargetFromRunArgs())) {
            const isAnyTarget =
                args.target.toLowerCase() === TargetType.Emulator ||
                args.target.toLowerCase() === TargetType.Device;
            const additionalFilter = isAttachRequest
                ? (el: IMobileTarget) => el.isOnline
                : undefined;
            const resultTarget = await mobilePlatform.resolveMobileTarget(
                args.target,
                additionalFilter,
            );

            // Save the result to config in case there are more than one possible target with this type (simulator/device)
            if (resultTarget && isAnyTarget) {
                const targetsCount = await mobilePlatform.getTargetsCountByFilter(
                    target => target.isVirtualTarget === resultTarget.isVirtualTarget,
                );
                if (targetsCount > 1) {
                    const launchScenariosManager = new LaunchScenariosManager(args.cwd);
                    launchScenariosManager.updateLaunchScenario(args, {
                        target:
                            args.platform === PlatformType.Android
                                ? resultTarget.name
                                : resultTarget.id,
                    });
                }
            }
        }
    }

    private async cleanUp(restart?: boolean): Promise<void> {
        await this.attachmentCleanUp();
        this.platform = null;

        this.cancellationTokenSource.cancel();
        this.cancellationTokenSource.dispose();

        this.onDidTerminateDebugSessionHandler.dispose();
        this.sessionManager.terminate(this.cordovaSession.getSessionId(), !!restart);

        await logger.dispose();
    }

    private async attachmentCleanUp(): Promise<void> {
        if (this.platform) {
            await this.platform.stopAndCleanUp();
        }

        this.cdpProxyErrorHandlerDescriptor?.dispose();
        if (this.cordovaCdpProxy) {
            await this.cordovaCdpProxy.stopServer();
            this.cordovaCdpProxy = null;
        }
    }

    private async establishDebugSession(attachArgs: ICordovaAttachRequestArgs): Promise<void> {
        if (this.cordovaCdpProxy) {
            const attachArguments =
                this.pwaSessionName === PwaDebugType.Chrome
                    ? this.jsDebugConfigAdapter.createChromeDebuggingConfig(
                          attachArgs,
                          CordovaDebugSession.CDP_PROXY_PORT,
                          this.pwaSessionName,
                          this.cordovaSession.getSessionId(),
                      )
                    : this.jsDebugConfigAdapter.createSafariDebuggingConfig(
                          attachArgs,
                          CordovaDebugSession.CDP_PROXY_PORT,
                          this.pwaSessionName,
                          this.cordovaSession.getSessionId(),
                      );

            const childDebugSessionStarted = await vscode.debug.startDebugging(
                this.workspaceManager.workspaceRoot,
                attachArguments,
                {
                    parentSession: this.vsCodeDebugSession,
                    consoleMode: vscode.DebugConsoleMode.MergeWithParent,
                },
            );
            if (!childDebugSessionStarted) {
                throw ErrorHelper.getInternalError(
                    InternalErrorCode.CouldNotStartChildDebugSession,
                );
            }
        } else {
            throw ErrorHelper.getInternalError(
                InternalErrorCode.CouldNotConnectToDebuggerWorkerProxyOffline,
            );
        }
    }

    private handleTerminateDebugSession(debugSession: vscode.DebugSession) {
        if (
            debugSession.configuration.cordovaDebugSessionId ===
                this.cordovaSession.getVSCodeDebugSession().id &&
            debugSession.type === this.pwaSessionName &&
            this.debugSessionStatus !== DebugSessionStatus.Reattaching
        ) {
            this.terminate();
        }
    }

    private async resolvePlatform(
        args: ICordovaAttachRequestArgs &
            Partial<Omit<ICordovaLaunchRequestArgs, keyof ICordovaAttachRequestArgs>>,
    ): Promise<AbstractPlatform> {
        const {
            cwd,
            devServerAddress,
            devServerPort,
            devServerTimeout,
            platform,
            url,
            livereload,
            livereloadDelay,
            forcePrepare,
            corsProxy,
            simulatePort,
            simulateTempDir,
            spaUrlRewrites,
            target,
            ionicLiveReload,
        } = args;
        const [projectType, runArgs, cordovaExecutable] = await Promise.all([
            TelemetryHelper.determineProjectTypes(cwd),
            this.workspaceManager.getRunArguments(cwd),
            this.workspaceManager.getCordovaExecutable(cwd),
        ]);
        const ionicDevServer = new IonicDevServer(
            cwd,
            this.outputLogger.bind(this),
            devServerAddress,
            devServerPort,
            devServerTimeout,
            cordovaExecutable,
        );
        ionicDevServer.onServerStop(() => this.stop());

        const env = CordovaProjectHelper.getEnvArgument(args.env, args.envFile);
        const runArguments = args.runArguments || runArgs;
        const port = args.port || 9222;

        const generalPlatformOptions: IGeneralPlatformOptions = {
            projectRoot: args.cwd,
            projectType,
            workspaceManager: this.workspaceManager,
            ionicDevServer,
            cordovaExecutable,
            cancellationTokenSource: this.cancellationTokenSource,
            env,
            port,
            target,
            ionicLiveReload,
            runArguments,
        };
        const androidPlatformOptions = generalPlatformOptions as IAndroidPlatformOptions;
        const iosPlatformOptions = {
            iosDebugProxyPort: args.iosDebugProxyPort || 9221,
            webkitRangeMin: args.webkitRangeMin || 9223,
            webkitRangeMax: args.webkitRangeMax || 9322,
            attachAttempts: args.attachAttempts || 20,
            attachDelay: args.attachDelay || 1000,
            ...generalPlatformOptions,
        } as IIosPlatformOptions;
        const browserPlatformOptions = {
            userDataDir:
                args.userDataDir || path.join(settingsHome(), BrowserPlatform.CHROME_DATA_DIR),
            pluginSimulator: this.workspaceManager.pluginSimulator,
            platform,
            url,
            livereload,
            livereloadDelay,
            forcePrepare,
            corsProxy,
            simulatePort,
            simulateTempDir,
            spaUrlRewrites,
            ...generalPlatformOptions,
        } as IBrowserPlatformOptions;

        let resolvedPlatform: AbstractPlatform;
        if (SimulateHelper.isSimulateTarget(target)) {
            resolvedPlatform = new BrowserPlatform(browserPlatformOptions, this.outputLogger);
        } else {
            switch (platform) {
                case PlatformType.Android:
                    resolvedPlatform = new AndroidPlatform(
                        androidPlatformOptions,
                        this.outputLogger,
                    );
                    break;
                case PlatformType.IOS:
                    resolvedPlatform = new IosPlatform(iosPlatformOptions, this.outputLogger);
                    break;
                case PlatformType.Serve:
                // https://github.com/apache/cordova-serve/blob/4ad258947c0e347ad5c0f20d3b48e3125eb24111/src/util.js#L27-L37
                case PlatformType.Windows:
                case PlatformType.AmazonFireos:
                case PlatformType.Blackberry10:
                case PlatformType.Firefoxos:
                case PlatformType.Ubuntu:
                case PlatformType.Wp8:
                case PlatformType.Browser:
                    resolvedPlatform = new BrowserPlatform(
                        browserPlatformOptions,
                        this.outputLogger,
                    );
                    break;
                default:
                    throw ErrorHelper.getInternalError(
                        InternalErrorCode.UnknownPlatform,
                        args.platform,
                    );
            }
        }

        if (resolvedPlatform instanceof BrowserPlatform) {
            resolvedPlatform.onBrowserStop(() => this.stop());
            resolvedPlatform.onChangeSimulateViewport(viewportData => {
                this.changeSimulateViewport(viewportData).catch(() => {
                    this.outputLogger(
                        localize(
                            "ViewportResizingFailed",
                            "Viewport resizing failed. Please try again.",
                        ),
                        true,
                    );
                });
            });
        }
        return resolvedPlatform;
    }

    private async changeSimulateViewport(data: simulate.ResizeViewportData): Promise<void> {
        await this.attachedDeferred.promise;
        if (this.cordovaCdpProxy) {
            this.cordovaCdpProxy.getSimPageTargetAPI()?.Emulation.setDeviceMetricsOverride({
                width: data.width,
                height: data.height,
                deviceScaleFactor: 0,
                mobile: true,
            });
        }
    }

    private async initializeTelemetry(projectRoot: string): Promise<void> {
        if (!this.isTelemetryInitialized) {
            const version = JSON.parse(
                fs.readFileSync(findFileInFolderHierarchy(__dirname, "package.json"), "utf-8"),
            ).version;
            // Enable telemetry, forced on for now.
            try {
                return Telemetry.init("cordova-tools-debug-adapter", version, {
                    isExtensionProcess: false,
                    projectRoot: projectRoot,
                });
            } catch (e) {
                this.outputLogger(
                    localize(
                        "CouldNotInitializeTelemetry",
                        "Could not initialize telemetry. {0}",
                        e.message || e.error || e.data || e,
                    ),
                );
            }
            this.isTelemetryInitialized = true;
        }
    }

    private async initializeSettings(
        args: ICordovaAttachRequestArgs | ICordovaLaunchRequestArgs,
    ): Promise<void> {
        if (!this.isSettingsInitialized) {
            this.workspaceManager = CordovaWorkspaceManager.getWorkspaceManagerByProjectRootPath(
                args.cwd,
            );
            logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Log);
            this.cdpProxyLogLevel = args.trace ? LogLevel.Custom : LogLevel.None;

            if (args.runtimeVersion) {
                NodeVersionHelper.nvmSupport(args);
            }

            if (!args.target) {
                if (args.platform === PlatformType.Browser) {
                    args.target = "chrome";
                } else {
                    args.target = TargetType.Emulator;
                }
                this.outputLogger(`Parameter target is not set - ${args.target} will be used`);
            }

            this.isSettingsInitialized = true;
        }
    }

    private static getTargetType(target: string): string {
        if (/emulator/i.test(target)) {
            return TargetType.Emulator;
        }

        if (/chrom/i.test(target)) {
            return TargetType.Chrome;
        }

        return TargetType.Device;
    }

    protected terminateWithErrorResponse(error: Error, response: DebugProtocol.Response): void {
        // We can't print error messages after the debugging session is stopped. This could break the extension work.
        if (error.name === CordovaDebugSession.CANCELLATION_ERROR_NAME) {
            return;
        }
        const errorString = error.message || error.name || "Error";
        this.sendErrorResponse(
            response,
            { format: errorString, id: 1 },
            undefined,
            undefined,
            ErrorDestination.User,
        );
    }

    private showError(error: Error): void {
        void vscode.window.showErrorMessage(error.message, {
            modal: true,
        });
        // We can't print error messages via debug session logger after the session is stopped. This could break the extension work.
        if (this.debugSessionStatus === DebugSessionStatus.Stopped) {
            OutputChannelLogger.getMainChannel().log(error.message);
            return;
        }
        this.outputLogger(error.message, true);
    }

    private async terminate(): Promise<void> {
        await vscode.commands.executeCommand(CordovaDebugSession.STOP_COMMAND, undefined, {
            sessionId: this.vsCodeDebugSession.id,
        });
    }
}
