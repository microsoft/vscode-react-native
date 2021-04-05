// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { Packager } from "../common/packager";
import { RNPackageVersions } from "../common/projectVersionHelper";
import { ExponentHelper } from "./exponent/exponentHelper";
import { ReactDirManager } from "./reactDirManager";
import { SettingsHelper } from "./settingsHelper";
import { PackagerStatusIndicator } from "./packagerStatusIndicator";
import { CommandExecutor } from "../common/commandExecutor";
import { isNullOrUndefined } from "../common/utils";
import { OutputChannelLogger } from "./log/OutputChannelLogger";
import { MobilePlatformDeps, GeneralMobilePlatform } from "./generalMobilePlatform";
import { PlatformResolver } from "./platformResolver";
import { ProjectVersionHelper } from "../common/projectVersionHelper";
import { TelemetryHelper } from "../common/telemetryHelper";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { TargetPlatformHelper } from "../common/targetPlatformHelper";
import { ProjectsStorage } from "./projectsStorage";
import { ReactNativeCDPProxy } from "../cdp-proxy/reactNativeCDPProxy";
import { generateRandomPortNumber } from "../common/extensionHelper";
import { DEBUG_TYPES } from "./debuggingConfiguration/debugConfigTypesAndConstants";
import * as nls from "vscode-nls";
import { MultipleLifetimesAppWorker } from "../debugger/appWorker";
import { PlatformType } from "./launchArgs";
import { LaunchScenariosManager } from "./launchScenariosManager";
import { IVirtualDevice } from "./VirtualDeviceManager";
import { createAdditionalWorkspaceFolder, onFolderAdded } from "./rn-extension";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class AppLauncher {
    private readonly cdpProxyPort: number;
    private readonly cdpProxyHostAddress: string;

    private appWorker: MultipleLifetimesAppWorker | null;
    private packager: Packager;
    private exponentHelper: ExponentHelper;
    private reactDirManager: ReactDirManager;
    private workspaceFolder: vscode.WorkspaceFolder;
    private reactNativeVersions?: RNPackageVersions;
    private rnCdpProxy: ReactNativeCDPProxy;
    private logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();
    private mobilePlatform: GeneralMobilePlatform;
    private launchScenariosManager: LaunchScenariosManager;

    public static async getAppLauncherByProjectRootPath(
        projectRootPath: string,
    ): Promise<AppLauncher> {
        let appLauncher = ProjectsStorage.projectsCache[projectRootPath.toLowerCase()];
        console.log(ProjectsStorage.projectsCache);
        if (!appLauncher) {
            const appLauncherFolder = createAdditionalWorkspaceFolder(projectRootPath);
            console.log(appLauncherFolder);
            if (appLauncherFolder) {
                await onFolderAdded(appLauncherFolder);
                console.log(ProjectsStorage.projectsCache);
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

    constructor(reactDirManager: ReactDirManager, workspaceFolder: vscode.WorkspaceFolder) {
        // constants definition
        this.cdpProxyPort = generateRandomPortNumber();
        this.cdpProxyHostAddress = "127.0.0.1"; // localhost

        const rootPath = workspaceFolder.uri.fsPath;
        this.launchScenariosManager = new LaunchScenariosManager(rootPath);
        const projectRootPath = SettingsHelper.getReactNativeProjectRoot(rootPath);
        this.exponentHelper = new ExponentHelper(rootPath, projectRootPath);
        const packagerStatusIndicator: PackagerStatusIndicator = new PackagerStatusIndicator(
            rootPath,
        );
        this.packager = new Packager(
            rootPath,
            projectRootPath,
            SettingsHelper.getPackagerPort(workspaceFolder.uri.fsPath),
            packagerStatusIndicator,
        );
        this.packager.setExponentHelper(this.exponentHelper);
        this.reactDirManager = reactDirManager;
        this.workspaceFolder = workspaceFolder;
        this.rnCdpProxy = new ReactNativeCDPProxy(this.cdpProxyHostAddress, this.cdpProxyPort);
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

    public getMobilePlatform(): GeneralMobilePlatform {
        return this.mobilePlatform;
    }

    public dispose(): void {
        this.packager.getStatusIndicator().dispose();
        this.packager.stop(true);
        this.mobilePlatform.dispose();
    }

    public openFileAtLocation(filename: string, lineNumber: number): Promise<void> {
        return new Promise(resolve => {
            vscode.workspace
                .openTextDocument(vscode.Uri.file(filename))
                .then((document: vscode.TextDocument) => {
                    vscode.window.showTextDocument(document).then((editor: vscode.TextEditor) => {
                        let range = editor.document.lineAt(lineNumber - 1).range;
                        editor.selection = new vscode.Selection(range.start, range.end);
                        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                        resolve();
                    });
                });
        });
    }

    public getPackagerPort(projectFolder: string): number {
        return SettingsHelper.getPackagerPort(projectFolder);
    }

    public launch(launchArgs: any): Promise<any> {
        let mobilePlatformOptions = this.requestSetup(launchArgs);

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

        if (launchArgs.type === DEBUG_TYPES.REACT_NATIVE_DIRECT) {
            mobilePlatformOptions.isDirect = true;
        }

        mobilePlatformOptions.packagerPort = SettingsHelper.getPackagerPort(
            launchArgs.cwd || launchArgs.program,
        );
        const platformDeps: MobilePlatformDeps = {
            packager: this.packager,
        };
        this.mobilePlatform = new PlatformResolver().resolveMobilePlatform(
            launchArgs.platform,
            mobilePlatformOptions,
            platformDeps,
        );
        return new Promise((resolve, reject) => {
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

            return ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
                mobilePlatformOptions.projectRoot,
                ProjectVersionHelper.generateAdditionalPackagesToCheckByPlatform(launchArgs),
            )
                .then(versions => {
                    mobilePlatformOptions.reactNativeVersions = versions;
                    extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
                        launchArgs,
                        versions,
                        extProps,
                    );

                    TelemetryHelper.generate("launch", extProps, generator => {
                        generator.step("resolveEmulator");
                        return this.resolveAndSaveVirtualDevice(
                            this.mobilePlatform,
                            launchArgs,
                            mobilePlatformOptions,
                        )
                            .then(() => this.mobilePlatform.beforeStartPackager())
                            .then(() => {
                                generator.step("checkPlatformCompatibility");
                                TargetPlatformHelper.checkTargetPlatformSupport(
                                    mobilePlatformOptions.platform,
                                );
                            })
                            .then(() => {
                                generator.step("startPackager");
                                return this.mobilePlatform.startPackager();
                            })
                            .then(() => {
                                // We've seen that if we don't prewarm the bundle cache, the app fails on the first attempt to connect to the debugger logic
                                // and the user needs to Reload JS manually. We prewarm it to prevent that issue
                                generator.step("prewarmBundleCache");
                                this.logger.info(
                                    localize(
                                        "PrewarmingBundleCache",
                                        "Prewarming bundle cache. This may take a while ...",
                                    ),
                                );
                                return this.mobilePlatform.prewarmBundleCache();
                            })
                            .then(() => {
                                generator
                                    .step("mobilePlatform.runApp")
                                    .add("target", mobilePlatformOptions.target, false);
                                this.logger.info(
                                    localize(
                                        "BuildingAndRunningApplication",
                                        "Building and running application.",
                                    ),
                                );
                                return this.mobilePlatform.runApp();
                            })
                            .then(() => {
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
                                        generator.step(
                                            "mobilePlatform.enableIosDirectDebuggingMode",
                                        );
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
                                    this.logger.info(
                                        localize("DisableJSDebugging", "Disable JS Debugging"),
                                    );
                                    return this.mobilePlatform.disableJSDebuggingMode();
                                } else {
                                    generator.step("mobilePlatform.enableJSDebuggingMode");
                                    this.logger.info(
                                        localize("EnableJSDebugging", "Enable JS Debugging"),
                                    );
                                    return this.mobilePlatform.enableJSDebuggingMode();
                                }
                            })
                            .then(resolve)
                            .catch(error => {
                                if (
                                    !mobilePlatformOptions.enableDebug &&
                                    launchArgs.platform === PlatformType.iOS &&
                                    launchArgs.type === DEBUG_TYPES.REACT_NATIVE
                                ) {
                                    // If we disable debugging mode for iOS scenarios, we'll we ignore the error and run the 'run-ios' command anyway,
                                    // since the error doesn't affects an application launch process
                                    return resolve();
                                }
                                generator.addError(error);
                                this.logger.error(error);
                                reject(error);
                            });
                    });
                })
                .catch(error => {
                    if (error && error.errorCode) {
                        if (
                            error.errorCode === InternalErrorCode.ReactNativePackageIsNotInstalled
                        ) {
                            TelemetryHelper.sendErrorEvent(
                                "ReactNativePackageIsNotInstalled",
                                ErrorHelper.getInternalError(
                                    InternalErrorCode.ReactNativePackageIsNotInstalled,
                                ),
                            );
                        } else if (
                            error.errorCode === InternalErrorCode.ReactNativeWindowsIsNotInstalled
                        ) {
                            TelemetryHelper.sendErrorEvent(
                                "ReactNativeWindowsPackageIsNotInstalled",
                                ErrorHelper.getInternalError(
                                    InternalErrorCode.ReactNativeWindowsIsNotInstalled,
                                ),
                            );
                        }
                    }
                    this.logger.error(error);
                    reject(error);
                });
        });
    }

    private resolveAndSaveVirtualDevice(
        mobilePlatform: GeneralMobilePlatform,
        launchArgs: any,
        mobilePlatformOptions: any,
    ): Promise<void> {
        if (
            launchArgs.target &&
            (mobilePlatformOptions.platform === PlatformType.Android ||
                mobilePlatformOptions.platform === PlatformType.iOS)
        ) {
            return mobilePlatform
                .resolveVirtualDevice(launchArgs.target)
                .then((emulator: IVirtualDevice | null) => {
                    if (emulator) {
                        if (emulator.name && launchArgs.platform === PlatformType.Android) {
                            mobilePlatformOptions.target = emulator.id;
                            this.launchScenariosManager.updateLaunchScenario(launchArgs, {
                                target: emulator.name,
                            });
                        }
                        if (launchArgs.platform === PlatformType.iOS) {
                            this.launchScenariosManager.updateLaunchScenario(launchArgs, {
                                target: emulator.id,
                            });
                        }
                        launchArgs.target = emulator.id;
                    } else if (
                        mobilePlatformOptions.target.indexOf("device") < 0 &&
                        launchArgs.platform === PlatformType.Android
                    ) {
                        // We should cleanup target only for Android platform,
                        // because react-native-cli does not support launch with Android emulator name
                        this.cleanupTargetModifications(mobilePlatform, mobilePlatformOptions);
                    }
                })
                .catch(error => {
                    if (
                        error &&
                        error.errorCode &&
                        error.errorCode === InternalErrorCode.VirtualDeviceSelectionError
                    ) {
                        TelemetryHelper.sendErrorEvent(
                            "VirtualDeviceSelectionError",
                            ErrorHelper.getInternalError(
                                InternalErrorCode.VirtualDeviceSelectionError,
                            ),
                        );

                        this.logger.warning(error);
                        this.logger.warning(
                            localize(
                                "ContinueWithRnCliWorkflow",
                                "Continue using standard RN CLI workflow.",
                            ),
                        );

                        if (mobilePlatformOptions.target.indexOf("device") < 0) {
                            this.cleanupTargetModifications(mobilePlatform, mobilePlatformOptions);
                        }
                        return Promise.resolve();
                    } else {
                        return Promise.reject(error);
                    }
                });
        }
        return Promise.resolve();
    }

    private cleanupTargetModifications(
        mobilePlatform: GeneralMobilePlatform,
        mobilePlatformOptions: any,
    ) {
        mobilePlatformOptions.target = "simulator";
        mobilePlatform.runArguments = mobilePlatform.getRunArguments();
    }

    private requestSetup(args: any): any {
        const workspaceFolder: vscode.WorkspaceFolder = <vscode.WorkspaceFolder>(
            vscode.workspace.getWorkspaceFolder(vscode.Uri.file(args.cwd || args.program))
        );
        const projectRootPath = this.getProjectRoot(args);
        let mobilePlatformOptions: any = {
            workspaceRoot: workspaceFolder.uri.fsPath,
            projectRoot: projectRootPath,
            platform: args.platform,
            env: args.env,
            envFile: args.envFile,
            target: args.target || "simulator",
            enableDebug: args.enableDebug,
        };

        if (args.platform === PlatformType.Exponent) {
            mobilePlatformOptions.expoHostType = args.expoHostType || "lan";
            mobilePlatformOptions.openExpoQR =
                typeof args.openExpoQR !== "boolean" ? true : args.openExpoQR;
        }

        CommandExecutor.ReactNativeCommand = SettingsHelper.getReactNativeGlobalCommandName(
            workspaceFolder.uri,
        );

        if (!args.runArguments) {
            let runArgs = SettingsHelper.getRunArgs(
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
