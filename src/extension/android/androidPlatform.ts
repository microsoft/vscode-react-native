// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as semver from "semver";
import { MobilePlatformDeps, TargetType } from "../generalPlatform";
import { IAndroidRunOptions, PlatformType } from "../launchArgs";
import { Package } from "../../common/node/package";
import { PackageNameResolver } from "./packageNameResolver";
import { OutputVerifier, PatternToFailure } from "../../common/outputVerifier";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { CommandExecutor } from "../../common/commandExecutor";
import { LogCatMonitor } from "./logCatMonitor";
import * as nls from "vscode-nls";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { notNullOrUndefined } from "../../common/utils";
import { PromiseUtil } from "../../common/node/promise";
import { LogCatMonitorManager } from "./logCatMonitorManager";
import { AndroidTarget, AndroidTargetManager } from "./androidTargetManager";
import { AdbHelper, AndroidAPILevel } from "./adb";
import { GeneralMobilePlatform } from "../generalMobilePlatform";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

/**
 * Android specific platform implementation for debugging RN applications.
 */
export class AndroidPlatform extends GeneralMobilePlatform {
    // We should add the common Android build/run errors we find to this list
    private static RUN_ANDROID_FAILURE_PATTERNS: PatternToFailure[] = [
        {
            pattern: "Failed to install on any devices",
            errorCode: InternalErrorCode.AndroidCouldNotInstallTheAppOnAnyAvailibleDevice,
        },
        {
            pattern: "com.android.ddmlib.ShellCommandUnresponsiveException",
            errorCode: InternalErrorCode.AndroidShellCommandTimedOut,
        },
        {
            pattern: "Android project not found",
            errorCode: InternalErrorCode.AndroidProjectNotFound,
        },
        {
            pattern: "error: more than one device/emulator",
            errorCode: InternalErrorCode.AndroidMoreThanOneDeviceOrEmulator,
        },
        {
            pattern: /^Error: Activity class \{.*\} does not exist\.$/m,
            errorCode: InternalErrorCode.AndroidFailedToLaunchTheSpecifiedActivity,
        },
    ];

    private static RUN_ANDROID_SUCCESS_PATTERNS: string[] = [
        "BUILD SUCCESSFUL",
        "Starting the app",
        "Starting: Intent",
    ];

    private packageName: string;
    private adbHelper: AdbHelper;
    private logCatMonitor: LogCatMonitor | null = null;
    private needsToLaunchApps: boolean = false;

    protected targetManager: AndroidTargetManager;
    protected target?: AndroidTarget;

    // We set remoteExtension = null so that if there is an instance of androidPlatform that wants to have it's custom remoteExtension it can. This is specifically useful for tests.
    constructor(protected runOptions: IAndroidRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);
        this.adbHelper = new AdbHelper(
            this.runOptions.projectRoot,
            runOptions.nodeModulesRoot,
            this.logger,
        );
        this.targetManager = new AndroidTargetManager(this.adbHelper);
    }

    public showDevMenu(deviceId?: string): Promise<void> {
        return this.adbHelper.showDevMenu(deviceId);
    }

    public reloadApp(deviceId?: string): Promise<void> {
        return this.adbHelper.reloadApp(deviceId);
    }

    public async getTarget(): Promise<AndroidTarget> {
        if (!this.target) {
            const onlineTargets = await this.adbHelper.getOnlineTargets();
            const onlineTargetsBySpecifiedType = onlineTargets.filter(target => {
                switch (this.runOptions.target) {
                    case TargetType.Simulator:
                        return target.isVirtualTarget;
                    case TargetType.Device:
                        return !target.isVirtualTarget;
                    default:
                        return true;
                }
            });
            if (onlineTargetsBySpecifiedType.length) {
                this.target = AndroidTarget.fromInterface(onlineTargetsBySpecifiedType[0]);
            } else if (onlineTargets.length) {
                this.logger.warning(
                    localize(
                        "ThereIsNoOnlineTargetWithSpecifiedTargetType",
                        "There is no any online target with specified target type '{0}'. Continue with any online target.",
                        this.runOptions.target,
                    ),
                );
                this.target = AndroidTarget.fromInterface(onlineTargets[0]);
            } else {
                throw ErrorHelper.getInternalError(
                    InternalErrorCode.AndroidThereIsNoAnyOnlineDebuggableTarget,
                );
            }
        }
        return this.target;
    }

    public async runApp(shouldLaunchInAllDevices: boolean = false): Promise<void> {
        let extProps: any = {
            platform: {
                value: PlatformType.Android,
                isPii: false,
            },
        };

        if (this.runOptions.isDirect) {
            extProps.isDirect = {
                value: true,
                isPii: false,
            };
        }

        extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
            this.runOptions,
            this.runOptions.reactNativeVersions,
            extProps,
        );

        await TelemetryHelper.generate("AndroidPlatform.runApp", extProps, async () => {
            const env = GeneralMobilePlatform.getEnvArgument(
                process.env,
                this.runOptions.env,
                this.runOptions.envFile,
            );

            if (
                !semver.valid(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                ) /*Custom RN implementations should support this flag*/ ||
                semver.gte(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                    AndroidPlatform.NO_PACKAGER_VERSION,
                )
            ) {
                this.runArguments.push("--no-packager");
            }

            let mainActivity = GeneralMobilePlatform.getOptFromRunArgs(
                this.runArguments,
                "--main-activity",
            );

            if (mainActivity) {
                this.adbHelper.setLaunchActivity(mainActivity);
            } else if (notNullOrUndefined(this.runOptions.debugLaunchActivity)) {
                this.runArguments.push("--main-activity", this.runOptions.debugLaunchActivity);
                this.adbHelper.setLaunchActivity(this.runOptions.debugLaunchActivity);
            }

            const runAndroidSpawn = new CommandExecutor(
                this.runOptions.nodeModulesRoot,
                this.projectPath,
                this.logger,
            ).spawnReactCommand("run-android", this.runArguments, { env });
            const output = new OutputVerifier(
                () => Promise.resolve(AndroidPlatform.RUN_ANDROID_SUCCESS_PATTERNS),
                () => Promise.resolve(AndroidPlatform.RUN_ANDROID_FAILURE_PATTERNS),
                PlatformType.Android,
            ).process(runAndroidSpawn);

            let devicesIdsForLaunch: string[] = [];
            const onlineTargetsIds = (await this.adbHelper.getOnlineTargets()).map(
                target => target.id,
            );
            let targetId: string | undefined;
            try {
                try {
                    await output;
                } finally {
                    targetId = await this.getTargetIdForRunApp(onlineTargetsIds);
                    this.packageName = await this.getPackageName();
                    devicesIdsForLaunch = [targetId];
                }
            } catch (error) {
                if (!targetId) {
                    targetId = await this.getTargetIdForRunApp(onlineTargetsIds);
                }
                if (
                    error.message ===
                        ErrorHelper.getInternalError(
                            InternalErrorCode.AndroidMoreThanOneDeviceOrEmulator,
                        ).message &&
                    onlineTargetsIds.length >= 1 &&
                    targetId
                ) {
                    /* If it failed due to multiple devices, we'll apply this workaround to make it work anyways */
                    this.needsToLaunchApps = true;
                    devicesIdsForLaunch = shouldLaunchInAllDevices ? onlineTargetsIds : [targetId];
                } else {
                    throw error;
                }
            }

            await PromiseUtil.forEach(devicesIdsForLaunch, deviceId =>
                this.launchAppWithADBReverseAndLogCat(deviceId),
            );
        });
    }

    public async enableJSDebuggingMode(): Promise<void> {
        return this.adbHelper.switchDebugMode(
            this.runOptions.projectRoot,
            this.packageName,
            true,
            (await this.getTarget()).id,
            this.getAppIdSuffixFromRunArgumentsIfExists(),
        );
    }

    public async disableJSDebuggingMode(): Promise<void> {
        return this.adbHelper.switchDebugMode(
            this.runOptions.projectRoot,
            this.packageName,
            false,
            (await this.getTarget()).id,
            this.getAppIdSuffixFromRunArgumentsIfExists(),
        );
    }

    public prewarmBundleCache(): Promise<void> {
        return this.packager.prewarmBundleCache(PlatformType.Android);
    }

    public getRunArguments(): string[] {
        let runArguments: string[] = [];

        if (this.runOptions.runArguments && this.runOptions.runArguments.length > 0) {
            runArguments = this.runOptions.runArguments;
        } else {
            if (this.runOptions.variant) {
                runArguments.push("--variant", this.runOptions.variant);
            }
            if (this.runOptions.target) {
                if (
                    this.runOptions.target !== TargetType.Device &&
                    this.runOptions.target !== TargetType.Simulator
                ) {
                    runArguments.push("--deviceId", this.runOptions.target);
                }
            }
        }

        return runArguments;
    }

    public dispose(): void {
        if (this.logCatMonitor) {
            LogCatMonitorManager.delMonitor(this.logCatMonitor.deviceId);
            this.logCatMonitor = null;
        }
    }

    private async getTargetIdForRunApp(onlineTargetsIds: string[]): Promise<string> {
        return this.runOptions.target &&
            this.runOptions.target !== TargetType.Simulator &&
            this.runOptions.target !== TargetType.Device &&
            onlineTargetsIds.find(id => id === this.runOptions.target)
            ? this.runOptions.target
            : (await this.getTarget()).id;
    }

    private getAppIdSuffixFromRunArgumentsIfExists(): string | undefined {
        const appIdSuffixIndex = this.runArguments.indexOf("--appIdSuffix");
        if (appIdSuffixIndex > -1) {
            return this.runArguments[appIdSuffixIndex + 1];
        }
        return undefined;
    }

    private async launchAppWithADBReverseAndLogCat(deviceId: string): Promise<void> {
        await this.configureADBReverseWhenApplicable(deviceId);
        if (this.needsToLaunchApps) {
            await this.adbHelper.launchApp(this.runOptions.projectRoot, this.packageName, deviceId);
        }
        return this.startMonitoringLogCat(deviceId, this.runOptions.logCatArguments);
    }

    private async configureADBReverseWhenApplicable(deviceId: string): Promise<void> {
        // For other emulators and devices we try to enable adb reverse
        const apiVersion = await this.adbHelper.apiVersion(deviceId);
        if (apiVersion >= AndroidAPILevel.LOLLIPOP) {
            // If we support adb reverse
            try {
                this.adbHelper.reverseAdb(deviceId, Number(this.runOptions.packagerPort));
            } catch (error) {
                // "adb reverse" command could work incorrectly with remote devices, then skip the error and try to go on
                if (
                    this.adbHelper.isRemoteTarget(deviceId) &&
                    error.message.includes(AndroidPlatform.RUN_ANDROID_FAILURE_PATTERNS[3].pattern)
                ) {
                    this.logger.warning(error.message);
                } else {
                    throw error;
                }
            }
        } else {
            this.logger.warning(
                localize(
                    "DeviceSupportsOnlyAPILevel",
                    "Device {0} supports only API Level {1}. \n Level {2} is needed to support port forwarding via adb reverse. \n For debugging to work you'll need <Shake or press menu button> for the dev menu, \n go into <Dev Settings> and configure <Debug Server host & port for Device> to be \n an IP address of your computer that the Device can reach. More info at: \n https://facebook.github.io/react-native/docs/debugging.html#debugging-react-native-apps",
                    deviceId,
                    apiVersion,
                    AndroidAPILevel.LOLLIPOP,
                ),
            );
        }
    }

    private async getPackageName(): Promise<string> {
        const appName = await new Package(this.runOptions.projectRoot).name();
        return new PackageNameResolver(appName).resolvePackageName(this.runOptions.projectRoot);
    }

    private startMonitoringLogCat(deviceId: string, logCatArguments: string[]): void {
        LogCatMonitorManager.delMonitor(deviceId); // Stop previous logcat monitor if it's running

        // this.logCatMonitor can be mutated, so we store it locally too
        this.logCatMonitor = new LogCatMonitor(deviceId, this.adbHelper, logCatArguments);
        LogCatMonitorManager.addMonitor(this.logCatMonitor);
        this.logCatMonitor
            .start() // The LogCat will continue running forever, so we don't wait for it
            .catch(error => {
                this.logger.warning(error);
                this.logger.warning(
                    localize("ErrorWhileMonitoringLogCat", "Error while monitoring LogCat"),
                );
            }); // The LogCatMonitor failing won't stop the debugging experience
    }
}
