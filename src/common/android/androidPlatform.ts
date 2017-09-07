// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {GeneralMobilePlatform, MobilePlatformDeps } from "../generalMobilePlatform";
import {Packager} from "../packager";
import {IAndroidRunOptions} from "../launchArgs";
import {IAdb, Adb, AndroidAPILevel, IDevice, DeviceType} from "./adb";
import {Package} from "../node/package";
import {PromiseUtil} from "../node/promise";
import {PackageNameResolver} from "./packageNameResolver";
import {OutputVerifier, PatternToFailure} from "../outputVerifier";
import {TelemetryHelper} from "../telemetryHelper";
import {CommandExecutor} from "../commandExecutor";
import {LogCatMonitor} from "../../extension/android/logCatMonitor";

export interface AndroidPlatformDeps extends MobilePlatformDeps {
    adb?: IAdb;
}
/**
 * Android specific platform implementation for debugging RN applications.
 */
export class AndroidPlatform extends GeneralMobilePlatform {
    private static MULTIPLE_DEVICES_ERROR = "error: more than one device/emulator";

    // We should add the common Android build/run errors we find to this list
    private static RUN_ANDROID_FAILURE_PATTERNS: PatternToFailure[] = [{
        pattern: "Failed to install on any devices",
        message: "Could not install the app on any available device. Make sure you have a correctly"
            + " configured device or emulator running. See https://facebook.github.io/react-native/docs/android-setup.html",
    }, {
        pattern: "com.android.ddmlib.ShellCommandUnresponsiveException",
        message: "An Android shell command timed-out. Please retry the operation.",
    }, {
        pattern: "Android project not found",
        message: "Android project not found.",

    }, {
        pattern: "error: more than one device/emulator",
        message: AndroidPlatform.MULTIPLE_DEVICES_ERROR,
    }, {
        pattern: /^Error: Activity class \{.*\} does not exist\.$/m,
        message: "Failed to launch the specified activity. Try running application manually and "
            + "start debugging using 'Attach to packager' launch configuration.",
    }];

    private static RUN_ANDROID_SUCCESS_PATTERNS: string[] = ["BUILD SUCCESSFUL", "Starting the app", "Starting: Intent"];

    private debugTarget: IDevice;
    private devices: IDevice[];
    private packageName: string;
    private adb: IAdb;
    private logCatMonitor: LogCatMonitor | null = null;

    private needsToLaunchApps: boolean = false;

    // We set remoteExtension = null so that if there is an instance of androidPlatform that wants to have it's custom remoteExtension it can. This is specifically useful for tests.
    constructor(protected runOptions: IAndroidRunOptions, platformDeps: AndroidPlatformDeps = {}) {
        super(runOptions, platformDeps);
        this.adb = platformDeps.adb || new Adb();
    }

    public runApp(shouldLaunchInAllDevices: boolean = false): Q.Promise<void> {
        return TelemetryHelper.generate("AndroidPlatform.runApp", () => {
            const runArguments = this.getRunArgument();
            const runAndroidSpawn = new CommandExecutor(this.projectPath, this.logger).spawnReactCommand("run-android", runArguments);

            const output = new OutputVerifier(
                () =>
                    Q(AndroidPlatform.RUN_ANDROID_SUCCESS_PATTERNS),
                () =>
                    Q(AndroidPlatform.RUN_ANDROID_FAILURE_PATTERNS)).process(runAndroidSpawn);

            return output
                .finally(() => {
                    return this.initializeTargetDevicesAndPackageName();
                }).then(() => [this.debugTarget], reason => {
                    if (reason.message === AndroidPlatform.MULTIPLE_DEVICES_ERROR && this.devices.length > 1 && this.debugTarget) {
                        /* If it failed due to multiple devices, we'll apply this workaround to make it work anyways */
                        this.needsToLaunchApps = true;
                        return shouldLaunchInAllDevices
                            ? this.adb.getOnlineDevices()
                            : Q([this.debugTarget]);
                    } else {
                        return Q.reject<IDevice[]>(reason);
                    }
                }).then(devices => {
                    return new PromiseUtil().forEach(devices, device => {
                        return this.launchAppWithADBReverseAndLogCat(device);
                    });
                });
        });
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        return this.adb.reloadAppInDebugMode(this.runOptions.projectRoot, this.packageName, this.debugTarget.id);
    }

    public prewarmBundleCache(): Q.Promise<void> {
        return this.packager.prewarmBundleCache("android");
    }

    public getRunArgument(): string[] {
        let runArguments: string[] = [];

        if (this.runOptions.runArguments  && this.runOptions.runArguments.length > 0) {
            runArguments = this.runOptions.runArguments;
        } else {
            if (this.runOptions.variant) {
                runArguments.push("--variant", this.runOptions.variant);
            }
            if (this.runOptions.target) {
                runArguments.push("--deviceId", this.runOptions.target);
            }
        }

        return runArguments;
    }

    private initializeTargetDevicesAndPackageName(): Q.Promise<void> {
        return this.adb.getConnectedDevices().then(devices => {
            this.devices = devices;
            this.debugTarget = this.getTargetEmulator(devices);
            return this.getPackageName().then(packageName => {
                this.packageName = packageName;
            });
        });
    }

    private launchAppWithADBReverseAndLogCat(device: IDevice): Q.Promise<void> {
        return Q({})
            .then(() => {
                return this.configureADBReverseWhenApplicable(device);
            }).then(() => {
                return this.needsToLaunchApps
                    ? this.adb.launchApp(this.runOptions.projectRoot, this.packageName, device.id)
                    : Q<void>(void 0);
            }).then(() => {
                return this.startMonitoringLogCat(device, this.runOptions.logCatArguments).catch(error => // The LogCatMonitor failing won't stop the debugging experience
                    this.logger.logWarning("Couldn't start LogCat monitor", error));
            });
    }

    private configureADBReverseWhenApplicable(device: IDevice): Q.Promise<void> {
        if (device.type !== DeviceType.AndroidSdkEmulator) {
            return Q({}) // For other emulators and devices we try to enable adb reverse
                .then(() => this.adb.apiVersion(device.id))
                .then(apiVersion => {
                    if (apiVersion >= AndroidAPILevel.LOLLIPOP) { // If we support adb reverse
                        return this.adb.reverseAdd(device.id, Packager.DEFAULT_PORT.toString(), this.runOptions.packagerPort);
                    } else {
                        this.logger.logWarning(`Device ${device.id} supports only API Level ${apiVersion}. `
                        + `Level ${AndroidAPILevel.LOLLIPOP} is needed to support port forwarding via adb reverse. `
                        + "For debugging to work you'll need <Shake or press menu button> for the dev menu, "
                        + "go into <Dev Settings> and configure <Debug Server host & port for Device> to be "
                        + "an IP address of your computer that the Device can reach. More info at: "
                        + "https://facebook.github.io/react-native/docs/debugging.html#debugging-react-native-apps");
                        return void 0;
                    }
                });
        } else {
            return Q<void>(void 0); // Android SDK emulators can connect directly to 10.0.0.2, so they don't need port forwarding
        }
    }

    private getPackageName(): Q.Promise<string> {
        return new Package(this.runOptions.projectRoot).name().then(appName =>
                new PackageNameResolver(appName).resolvePackageName(this.runOptions.projectRoot));
    }

    /**
     * Returns the target emulator, using the following logic:
     * *  If an emulator is specified and it is connected, use that one.
     * *  Otherwise, use the first one in the list.
     */
    private getTargetEmulator(devices: IDevice[]): IDevice {
        let activeFilterFunction = (device: IDevice) => {
            return device.isOnline;
        };

        let targetFilterFunction = (device: IDevice) => {
            return device.id === this.runOptions.target && activeFilterFunction(device);
        };

        if (this.runOptions && this.runOptions.target && devices) {
            /* check if the specified target is active */
            const targetDevice = devices.find(targetFilterFunction);
            if (targetDevice) {
                return targetDevice;
            }
        }

        /* return the first active device in the list */
        let activeDevices = devices && devices.filter(activeFilterFunction);
        return activeDevices && activeDevices[0];
    }

    private startMonitoringLogCat(device: IDevice, logCatArguments: string): Q.Promise<void> {
        this.stopMonitoringLogCat(); // Stop previous logcat monitor if it's running

        // this.logCatMonitor can be mutated, so we store it locally too
        const logCatMonitor = this.logCatMonitor = new LogCatMonitor(device.id, logCatArguments);
        logCatMonitor.start() // The LogCat will continue running forever, so we don't wait for it
            .catch(error =>
                this.logger.logWarning("Error while monitoring LogCat", error))
            .done();

        return Q.resolve<void>(void 0);
    }

    private stopMonitoringLogCat(): void {
        if (this.logCatMonitor) {
            this.logCatMonitor.dispose();
            this.logCatMonitor = null;
        }
    }
}
