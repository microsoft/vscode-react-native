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
import { IDebuggableMobileTarget } from "../mobileTarget";
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
    protected lastTarget?: AndroidTarget;

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

    public async getLastTarget(): Promise<AndroidTarget> {
        if (!this.lastTarget) {
            const onlineTargets = await this.adbHelper.getOnlineTargets();
            if (onlineTargets.length) {
                this.lastTarget = AndroidTarget.fromInterface(onlineTargets[0]);
            } else {
                throw ErrorHelper.getInternalError(
                    InternalErrorCode.AndroidThereIsNoAnyOnlineDebuggableTarget,
                );
            }
        }
        return this.lastTarget;
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

            let devicesForLaunch: IDebuggableMobileTarget[] = [];
            const onlineTargets = await this.adbHelper.getOnlineTargets();
            try {
                try {
                    await output;
                } finally {
                    this.packageName = await this.getPackageName();
                    devicesForLaunch = [await this.getLastTarget()];
                }
            } catch (error) {
                if (
                    error.message ===
                        ErrorHelper.getInternalError(
                            InternalErrorCode.AndroidMoreThanOneDeviceOrEmulator,
                        ).message &&
                    onlineTargets.length >= 1 &&
                    (await this.getLastTarget())
                ) {
                    /* If it failed due to multiple devices, we'll apply this workaround to make it work anyways */
                    this.needsToLaunchApps = true;
                    devicesForLaunch = shouldLaunchInAllDevices
                        ? onlineTargets
                        : [await this.getLastTarget()];
                } else {
                    throw error;
                }
            }

            await PromiseUtil.forEach(devicesForLaunch, device =>
                this.launchAppWithADBReverseAndLogCat(device),
            );
        });
    }

    public async enableJSDebuggingMode(): Promise<void> {
        return this.adbHelper.switchDebugMode(
            this.runOptions.projectRoot,
            this.packageName,
            true,
            (await this.getLastTarget()).id,
            this.getAppIdSuffixFromRunArgumentsIfExists(),
        );
    }

    public async disableJSDebuggingMode(): Promise<void> {
        return this.adbHelper.switchDebugMode(
            this.runOptions.projectRoot,
            this.packageName,
            false,
            (await this.getLastTarget()).id,
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
                    this.runOptions.target === TargetType.Device ||
                    this.runOptions.target === TargetType.Simulator
                ) {
                    const message = localize(
                        "TargetIsNotSupportedForAndroid",
                        "Target {0} is not supported for Android platform. \n If you want to use particular device or simulator for launching Android app,\n please specify device id (as in 'adb devices' output) instead.",
                        this.runOptions.target,
                    );
                    this.logger.warning(message);
                } else {
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

    private getAppIdSuffixFromRunArgumentsIfExists(): string | undefined {
        const appIdSuffixIndex = this.runArguments.indexOf("--appIdSuffix");
        if (appIdSuffixIndex > -1) {
            return this.runArguments[appIdSuffixIndex + 1];
        }
        return undefined;
    }

    private async launchAppWithADBReverseAndLogCat(device: IDebuggableMobileTarget): Promise<void> {
        await this.configureADBReverseWhenApplicable(device);
        if (this.needsToLaunchApps) {
            await this.adbHelper.launchApp(
                this.runOptions.projectRoot,
                this.packageName,
                device.id,
            );
        }
        return this.startMonitoringLogCat(device, this.runOptions.logCatArguments);
    }

    private async configureADBReverseWhenApplicable(
        device: IDebuggableMobileTarget,
    ): Promise<void> {
        // For other emulators and devices we try to enable adb reverse
        const apiVersion = await this.adbHelper.apiVersion(device.id);
        if (apiVersion >= AndroidAPILevel.LOLLIPOP) {
            // If we support adb reverse
            try {
                this.adbHelper.reverseAdb(device.id, Number(this.runOptions.packagerPort));
            } catch (error) {
                // "adb reverse" command could work incorrectly with remote devices, then skip the error and try to go on
                if (
                    this.adbHelper.isRemoteTarget(device.id) &&
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
                    device.id,
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

    private startMonitoringLogCat(
        device: IDebuggableMobileTarget,
        logCatArguments: string[],
    ): void {
        LogCatMonitorManager.delMonitor(device.id); // Stop previous logcat monitor if it's running

        // this.logCatMonitor can be mutated, so we store it locally too
        this.logCatMonitor = new LogCatMonitor(device.id, this.adbHelper, logCatArguments);
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
