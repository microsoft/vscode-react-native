// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import * as execa from "execa";
import * as BrowserHelper from "vscode-js-debug-browsers";
import { Packager } from "../common/packager";
import { RNPackageVersions, ProjectVersionHelper } from "../common/projectVersionHelper";
import { CommandExecutor } from "../common/commandExecutor";
import { isNullOrUndefined } from "../common/utils";
import { TelemetryHelper } from "../common/telemetryHelper";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { TargetPlatformHelper } from "../common/targetPlatformHelper";
import {
    getNodeModulesInFolderHierarchy,
    generateRandomPortNumber,
} from "../common/extensionHelper";
import { ReactNativeCDPProxy } from "../cdp-proxy/reactNativeCDPProxy";
import { MultipleLifetimesAppWorker } from "../debugger/appWorker";
import { HostPlatform } from "../common/hostPlatform";
import { ProjectsStorage } from "./projectsStorage";
import { PlatformResolver } from "./platformResolver";
import {
    BrowserTargetType,
    GeneralPlatform,
    MobilePlatformDeps,
    TargetType,
} from "./generalPlatform";
import { OutputChannelLogger } from "./log/OutputChannelLogger";
import { PackagerStatusIndicator } from "./packagerStatusIndicator";
import { SettingsHelper } from "./settingsHelper";
import { ReactDirManager } from "./reactDirManager";
import { ExponentHelper } from "./exponent/exponentHelper";
import { DEBUG_TYPES } from "./debuggingConfiguration/debugConfigTypesAndConstants";
import { IBaseArgs, PlatformType } from "./launchArgs";
import { LaunchScenariosManager } from "./launchScenariosManager";
import { createAdditionalWorkspaceFolder, onFolderAdded } from "./rn-extension";
import { RNProjectObserver } from "./rnProjectObserver";
import { GeneralMobilePlatform } from "./generalMobilePlatform";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class AppLauncher {
    private readonly cdpProxyPort = generateRandomPortNumber();
    /** localhost */
    private readonly cdpProxyHostAddress = "127.0.0.1";
    public static readonly CHROME_DATA_DIR = "chrome_sandbox_dir";
    private appWorker: MultipleLifetimesAppWorker | null;
    private packager: Packager;
    private exponentHelper: ExponentHelper;
    private reactNativeVersions?: RNPackageVersions;
    private rnCdpProxy: ReactNativeCDPProxy;
    private logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();
    private mobilePlatform: GeneralPlatform;
    private launchScenariosManager: LaunchScenariosManager;
    private debugConfigurationRoot: string;
    private nodeModulesRoot?: string;
    private browserProc: child_process.ChildProcess | null;
    private browserStopEventEmitter: vscode.EventEmitter<Error | undefined> =
        new vscode.EventEmitter();

    public static getAppLauncherByProjectRootPath(projectRootPath: string): AppLauncher {
        const appLauncher = ProjectsStorage.projectsCache[projectRootPath.toLowerCase()];
        if (!appLauncher) {
            throw new Error(
                `Could not find AppLauncher by the project root path ${projectRootPath}`,
            );
        }

        return appLauncher;
    }

    public static async getOrCreateAppLauncherByProjectRootPath(
        projectRootPath: string,
    ): Promise<AppLauncher> {
        let appLauncher = ProjectsStorage.projectsCache[projectRootPath.toLowerCase()];
        if (!appLauncher) {
            const appLauncherFolder = createAdditionalWorkspaceFolder(projectRootPath);
            if (appLauncherFolder) {
                await onFolderAdded(appLauncherFolder);
                appLauncher =
                    ProjectsStorage.projectsCache[appLauncherFolder.uri.fsPath.toLocaleLowerCase()];
            }
            if (!appLauncher) {
                throw new Error(
                    `Could not find AppLauncher by the project root path ${projectRootPath}`,
                );
            }
        }

        return appLauncher;
    }

    public static getNodeModulesRootByProjectPath(projectRootPath: string): string {
        const appLauncher: AppLauncher =
            AppLauncher.getAppLauncherByProjectRootPath(projectRootPath);

        return appLauncher.getOrUpdateNodeModulesRoot();
    }

    constructor(
        private reactDirManager: ReactDirManager,
        private projectObserver: RNProjectObserver,
        private workspaceFolder: vscode.WorkspaceFolder,
    ) {
        this.debugConfigurationRoot = workspaceFolder.uri.fsPath;

        const projectRootPath = SettingsHelper.getReactNativeProjectRoot(
            this.debugConfigurationRoot,
        );

        this.launchScenariosManager = new LaunchScenariosManager(this.debugConfigurationRoot);
        this.exponentHelper = new ExponentHelper(this.debugConfigurationRoot, projectRootPath);
        this.packager = new Packager(
            this.debugConfigurationRoot,
            projectRootPath,
            SettingsHelper.getPackagerPort(workspaceFolder.uri.fsPath),
            new PackagerStatusIndicator(this.debugConfigurationRoot),
        );
        this.packager.setExponentHelper(this.exponentHelper);
        this.rnCdpProxy = new ReactNativeCDPProxy(this.cdpProxyHostAddress, this.cdpProxyPort);
    }

    public updateDebugConfigurationRoot(debugConfigurationRoot: string): void {
        if (this.debugConfigurationRoot !== debugConfigurationRoot) {
            this.debugConfigurationRoot = debugConfigurationRoot;
            this.launchScenariosManager = new LaunchScenariosManager(this.debugConfigurationRoot);
        }
    }

    public getCdpProxyPort(): number {
        return this.cdpProxyPort;
    }

    public getRnCdpProxy(): ReactNativeCDPProxy {
        return this.rnCdpProxy;
    }

    public getPackager(): Packager {
        return this.packager;
    }

    public getWorkspaceFolderUri(): vscode.Uri {
        return this.workspaceFolder.uri;
    }

    public getWorkspaceFolder(): vscode.WorkspaceFolder {
        return this.workspaceFolder;
    }

    public getReactNativeVersions(): RNPackageVersions | undefined {
        return this.reactNativeVersions;
    }

    public getExponentHelper(): ExponentHelper {
        return this.exponentHelper;
    }

    public getReactDirManager(): ReactDirManager {
        return this.reactDirManager;
    }

    public setReactNativeVersions(reactNativeVersions: RNPackageVersions): void {
        this.reactNativeVersions = reactNativeVersions;
    }

    public setAppWorker(appWorker: MultipleLifetimesAppWorker): void {
        this.appWorker = appWorker;
    }

    public getAppWorker(): MultipleLifetimesAppWorker | null {
        return this.appWorker;
    }

    public getMobilePlatform(): GeneralPlatform {
        return this.mobilePlatform;
    }

    public getOrUpdateNodeModulesRoot(forceUpdate = false): string {
        if (!this.nodeModulesRoot || forceUpdate) {
            const nodeModulesRootPath: string | null = getNodeModulesInFolderHierarchy(
                this.packager.getProjectPath(),
            );

            if (!nodeModulesRootPath) {
                throw ErrorHelper.getInternalError(
                    InternalErrorCode.ReactNativePackageIsNotInstalled,
                );
            }

            this.nodeModulesRoot = nodeModulesRootPath;
        }

        return this.nodeModulesRoot as string;
    }

    public dispose(): void {
        this.packager.getStatusIndicator().dispose();
        void this.packager.stop(true);
        this.mobilePlatform.dispose();
    }

    public async openFileAtLocation(filename: string, lineNumber: number): Promise<void> {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filename));
        const editor = await vscode.window.showTextDocument(document);
        const range = editor.document.lineAt(lineNumber - 1).range;
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    }

    public getPackagerPort(projectFolder: string): number {
        return SettingsHelper.getPackagerPort(projectFolder);
    }

    public prepareBaseRunOptions(args: any): IBaseArgs {
        const workspaceFolder: vscode.WorkspaceFolder = <vscode.WorkspaceFolder>(
            vscode.workspace.getWorkspaceFolder(vscode.Uri.file(args.cwd || args.program))
        );
        const baseRunOptions: IBaseArgs = {
            platform: args.platform,
            workspaceRoot: workspaceFolder.uri.fsPath,
            projectRoot: this.getProjectRoot(args),
            env: args.env,
            envFile: args.envFile,
            nodeModulesRoot: this.getOrUpdateNodeModulesRoot(),
            isDirect: args.type === DEBUG_TYPES.REACT_NATIVE_DIRECT,
            packagerPort: SettingsHelper.getPackagerPort(args.cwd || args.program),
        };
        return baseRunOptions;
    }

    public async launch(launchArgs: any): Promise<any> {
        const mobilePlatformOptions = this.requestSetup(launchArgs);

        // We add the parameter if it's defined (adapter crashes otherwise)
        if (!isNullOrUndefined(launchArgs.logCatArguments)) {
            mobilePlatformOptions.logCatArguments = [
                this.parseLogCatArguments(launchArgs.logCatArguments),
            ];
        }

        if (!isNullOrUndefined(launchArgs.variant)) {
            mobilePlatformOptions.variant = launchArgs.variant;
        }

        if (!isNullOrUndefined(launchArgs.scheme)) {
            mobilePlatformOptions.scheme = launchArgs.scheme;
        }

        if (!isNullOrUndefined(launchArgs.productName)) {
            mobilePlatformOptions.productName = launchArgs.productName;
        }

        if (!isNullOrUndefined(launchArgs.launchActivity)) {
            mobilePlatformOptions.debugLaunchActivity = launchArgs.launchActivity;
        }

        const platformDeps: MobilePlatformDeps = {
            packager: this.packager,
            projectObserver: this.projectObserver,
        };
        this.mobilePlatform = new PlatformResolver().resolveMobilePlatform(
            launchArgs.platform,
            mobilePlatformOptions,
            platformDeps,
        );

        let extProps: any = {
            platform: {
                value: launchArgs.platform,
                isPii: false,
            },
        };

        if (mobilePlatformOptions.isDirect) {
            extProps.isDirect = {
                value: true,
                isPii: false,
            };
        }

        try {
            const versions =
                await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
                    mobilePlatformOptions.nodeModulesRoot,
                    ProjectVersionHelper.generateAdditionalPackagesToCheckByPlatform(launchArgs),
                );
            mobilePlatformOptions.reactNativeVersions = versions;
            extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
                launchArgs,
                versions,
                extProps,
            );

            await TelemetryHelper.generate("launch", extProps, async generator => {
                try {
                    if (this.mobilePlatform instanceof GeneralMobilePlatform) {
                        generator.step("resolveMobileTarget");
                        await this.resolveAndSaveMobileTarget(launchArgs, this.mobilePlatform);
                    }

                    await this.mobilePlatform.beforeStartPackager();

                    generator.step("checkPlatformCompatibility");
                    TargetPlatformHelper.checkTargetPlatformSupport(mobilePlatformOptions.platform);

                    generator.step("startPackager");
                    await this.mobilePlatform.startPackager();

                    // We've seen that if we don't prewarm the bundle cache, the app fails on the first attempt to connect to the debugger logic
                    // and the user needs to Reload JS manually. We prewarm it to prevent that issue
                    generator.step("prewarmBundleCache");
                    this.logger.info(
                        localize(
                            "PrewarmingBundleCache",
                            "Prewarming bundle cache. This may take a while ...",
                        ),
                    );
                    await this.mobilePlatform.prewarmBundleCache();

                    generator
                        .step("mobilePlatform.runApp")
                        .add("target", mobilePlatformOptions.target, false);
                    this.logger.info(
                        localize(
                            "BuildingAndRunningApplication",
                            "Building and running application.",
                        ),
                    );
                    await this.mobilePlatform.runApp();

                    if (mobilePlatformOptions.isDirect) {
                        if (launchArgs.useHermesEngine) {
                            generator.step("mobilePlatform.enableHermesDebuggingMode");
                            if (mobilePlatformOptions.enableDebug) {
                                this.logger.info(
                                    localize(
                                        "PrepareHermesDebugging",
                                        "Prepare Hermes debugging (experimental)",
                                    ),
                                );
                            } else {
                                this.logger.info(
                                    localize(
                                        "PrepareHermesLaunch",
                                        "Prepare Hermes launch (experimental)",
                                    ),
                                );
                            }
                        } else if (launchArgs.platform === PlatformType.iOS) {
                            generator.step("mobilePlatform.enableIosDirectDebuggingMode");
                            if (mobilePlatformOptions.enableDebug) {
                                this.logger.info(
                                    localize(
                                        "PrepareDirectIosDebugging",
                                        "Prepare direct iOS debugging (experimental)",
                                    ),
                                );
                            } else {
                                this.logger.info(
                                    localize(
                                        "PrepareDirectIosLaunch",
                                        "Prepare direct iOS launch (experimental)",
                                    ),
                                );
                            }
                        }
                        generator.step("mobilePlatform.disableJSDebuggingMode");
                        this.logger.info(localize("DisableJSDebugging", "Disable JS Debugging"));
                        await this.mobilePlatform.disableJSDebuggingMode();
                    } else {
                        generator.step("mobilePlatform.enableJSDebuggingMode");
                        this.logger.info(localize("EnableJSDebugging", "Enable JS Debugging"));
                        await this.mobilePlatform.enableJSDebuggingMode();
                    }
                } catch (error) {
                    if (
                        !mobilePlatformOptions.enableDebug &&
                        launchArgs.platform === PlatformType.iOS &&
                        launchArgs.type === DEBUG_TYPES.REACT_NATIVE
                    ) {
                        // If we disable debugging mode for iOS scenarios, we'll we ignore the error and run the 'run-ios' command anyway,
                        // since the error doesn't affects an application launch process
                        return;
                    }
                    generator.addError(error);
                    this.logger.error(error);
                    throw error;
                }
            });
        } catch (error) {
            if (error && error.errorCode) {
                if (error.errorCode === InternalErrorCode.ReactNativePackageIsNotInstalled) {
                    TelemetryHelper.sendErrorEvent(
                        "ReactNativePackageIsNotInstalled",
                        ErrorHelper.getInternalError(
                            InternalErrorCode.ReactNativePackageIsNotInstalled,
                        ),
                    );
                } else if (error.errorCode === InternalErrorCode.ReactNativeWindowsIsNotInstalled) {
                    TelemetryHelper.sendErrorEvent(
                        "ReactNativeWindowsPackageIsNotInstalled",
                        ErrorHelper.getInternalError(
                            InternalErrorCode.ReactNativeWindowsIsNotInstalled,
                        ),
                    );
                }
            }
            this.logger.error(error);
            throw error;
        }
    }

    public async launchExpoWeb(launchArgs: any): Promise<any> {
        const platformOptions = this.requestSetup(launchArgs);

        const platformDeps: MobilePlatformDeps = {
            packager: this.packager,
            projectObserver: this.projectObserver,
        };
        this.mobilePlatform = new PlatformResolver().resolveMobilePlatform(
            launchArgs.platform,
            platformOptions,
            platformDeps,
        );

        let extProps: any = {
            platform: {
                value: launchArgs.platform,
                isPii: false,
            },
        };

        if (platformOptions.isDirect) {
            extProps.isDirect = {
                value: true,
                isPii: false,
            };
        }

        try {
            const versions =
                await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
                    platformOptions.nodeModulesRoot,
                    ProjectVersionHelper.generateAdditionalPackagesToCheckByPlatform(launchArgs),
                );
            platformOptions.reactNativeVersions = versions;
            extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
                launchArgs,
                versions,
                extProps,
            );

            await TelemetryHelper.generate("launch", extProps, async generator => {
                try {
                    if (this.mobilePlatform instanceof GeneralMobilePlatform) {
                        generator.step("resolveMobileTarget");
                        await this.resolveAndSaveMobileTarget(launchArgs, this.mobilePlatform);
                    }

                    await this.mobilePlatform.beforeStartPackager();

                    generator.step("checkPlatformCompatibility");
                    TargetPlatformHelper.checkTargetPlatformSupport(platformOptions.platform);

                    generator.step("startPackager");
                    await this.mobilePlatform.startPackager();
                } catch (error) {
                    generator.addError(error);
                    this.logger.error(error);
                    throw error;
                }
            });
        } catch (error) {
            if (error && error.errorCode) {
                if (error.errorCode === InternalErrorCode.ReactNativePackageIsNotInstalled) {
                    TelemetryHelper.sendErrorEvent(
                        "ReactNativePackageIsNotInstalled",
                        ErrorHelper.getInternalError(
                            InternalErrorCode.ReactNativePackageIsNotInstalled,
                        ),
                    );
                } else if (error.errorCode === InternalErrorCode.ReactNativeWindowsIsNotInstalled) {
                    TelemetryHelper.sendErrorEvent(
                        "ReactNativeWindowsPackageIsNotInstalled",
                        ErrorHelper.getInternalError(
                            InternalErrorCode.ReactNativeWindowsIsNotInstalled,
                        ),
                    );
                }
            }
            this.logger.error(error);
            throw error;
        }
    }

    public async launchBrowser(launchArgs: any): Promise<void> {
        const runArguments = this.getRunArguments(launchArgs);

        // Launch browser
        let browserFinder: BrowserHelper.IBrowserFinder;
        if (launchArgs.platform == PlatformType.ExpoWeb) {
            switch (launchArgs.browserTarget) {
                case BrowserTargetType.Edge:
                    browserFinder = new BrowserHelper.EdgeBrowserFinder(
                        process.env,
                        fs.promises,
                        execa,
                    );
                    break;
                case BrowserTargetType.Chrome:
                default:
                    browserFinder = new BrowserHelper.ChromeBrowserFinder(
                        process.env,
                        fs.promises,
                        execa,
                    );
            }
            const browserPath = (await browserFinder.findAll())[0];
            if (browserPath) {
                this.browserProc = child_process.spawn(browserPath.path, runArguments, {
                    detached: true,
                    stdio: ["ignore"],
                });
                this.browserProc.unref();
                this.browserProc.on("error", err => {
                    const errMsg = localize("BrowserError", "Browser error: {0}", err.message);
                    this.logger.error(errMsg);
                    this.browserStopEventEmitter.fire(err);
                });
                this.browserProc.once("exit", (code: number) => {
                    const exitMessage = localize(
                        "BrowserExit",
                        "Browser has been closed with exit code: {0}",
                        code,
                    );
                    this.logger.info(exitMessage);
                    this.browserStopEventEmitter.fire(undefined);
                });
            }
        }
    }

    public getRunArguments(launchArgs: any): string[] {
        const args: string[] = [
            `--remote-debugging-port=9222`,
            "--no-first-run",
            "--no-default-browser-check",
            `--user-data-dir=${path.join(
                HostPlatform.getSettingsHome(),
                AppLauncher.CHROME_DATA_DIR,
            )}`,
        ];
        if (launchArgs.runArguments) {
            const runArguments = [...launchArgs.runArguments];
            const remoteDebuggingPort = GeneralPlatform.getOptFromRunArgs(
                runArguments,
                "--remote-debugging-port",
            );
            const noFirstRun = GeneralPlatform.getOptFromRunArgs(
                runArguments,
                "--no-first-run",
                true,
            );
            const noDefaultBrowserCheck = GeneralPlatform.getOptFromRunArgs(
                runArguments,
                "--no-default-browser-check",
                true,
            );
            const userDataDir = GeneralPlatform.getOptFromRunArgs(runArguments, "--user-data-dir");

            if (noFirstRun) {
                GeneralPlatform.removeRunArgument(runArguments, "--no-first-run", true);
            }
            if (noDefaultBrowserCheck) {
                GeneralPlatform.removeRunArgument(runArguments, "--no-default-browser-check", true);
            }
            if (remoteDebuggingPort) {
                GeneralPlatform.setRunArgument(
                    args,
                    "--remote-debugging-port",
                    remoteDebuggingPort,
                );
                GeneralPlatform.removeRunArgument(runArguments, "--remote-debugging-port", false);
            }
            if (userDataDir) {
                GeneralPlatform.setRunArgument(args, "--user-data-dir", userDataDir);
                GeneralPlatform.removeRunArgument(runArguments, "--user-data-dir", false);
            }

            args.push(...runArguments);
        }
        if (launchArgs.url) {
            args.push(launchArgs.url);
        }
        return args;
    }

    private async resolveAndSaveMobileTarget(
        launchArgs: any,
        mobilePlatform: GeneralMobilePlatform,
    ): Promise<void> {
        if (launchArgs.target && !(await mobilePlatform.getTargetFromRunArgs())) {
            const isAnyTarget =
                launchArgs.target.toLowerCase() === TargetType.Simulator ||
                launchArgs.target.toLowerCase() === TargetType.Device;
            const resultTarget = await mobilePlatform.resolveMobileTarget(launchArgs.target);

            // Save the result to config in case there are more than one possible target with this type (simulator/device)
            if (resultTarget && isAnyTarget) {
                const targetsCount = await mobilePlatform.getTargetsCountByFilter(
                    target => target.isVirtualTarget === resultTarget.isVirtualTarget,
                );
                if (targetsCount > 1) {
                    this.launchScenariosManager.updateLaunchScenario(launchArgs, {
                        target:
                            launchArgs.platform === PlatformType.Android
                                ? resultTarget.name
                                : resultTarget.id,
                    });
                }
            }
        }
    }

    private requestSetup(args: any): any {
        const workspaceFolder: vscode.WorkspaceFolder = <vscode.WorkspaceFolder>(
            vscode.workspace.getWorkspaceFolder(vscode.Uri.file(args.cwd || args.program))
        );
        const mobilePlatformOptions: any = Object.assign(
            { target: args.target, enableDebug: args.enableDebug },
            this.prepareBaseRunOptions(args),
        );

        if (args.platform === PlatformType.Exponent) {
            mobilePlatformOptions.expoHostType = args.expoHostType || "lan";
            mobilePlatformOptions.openExpoQR =
                typeof args.openExpoQR !== "boolean" ? true : args.openExpoQR;
        }

        CommandExecutor.ReactNativeCommand = SettingsHelper.getReactNativeGlobalCommandName(
            workspaceFolder.uri,
        );

        if (!args.runArguments) {
            const runArgs = SettingsHelper.getRunArgs(
                args.platform,
                args.target || "simulator",
                workspaceFolder.uri,
            );
            mobilePlatformOptions.runArguments = runArgs;
        } else {
            mobilePlatformOptions.runArguments = args.runArguments;
        }
        return mobilePlatformOptions;
    }

    private getProjectRoot(args: any): string {
        return SettingsHelper.getReactNativeProjectRoot(args.cwd || args.program);
    }

    /**
     * Parses log cat arguments to a string
     */
    private parseLogCatArguments(userProvidedLogCatArguments: any): string {
        return Array.isArray(userProvidedLogCatArguments)
            ? userProvidedLogCatArguments.join(" ") // If it's an array, we join the arguments
            : userProvidedLogCatArguments; // If not, we leave it as-is
    }
}
