// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {GeneralMobilePlatform} from "../../debugger/generalMobilePlatform";
import {Packager} from "../../common/packager";
import {IRunOptions} from "../../common/launchArgs";
import {Log} from "../../common/log/log";
import {IAdb, Adb, AndroidAPILevel, IDevice, DeviceType} from "../../common/android/adb";
import {Package} from "../../common/node/package";
import {PromiseUtil} from "../../common/node/promise";
import {PackageNameResolver} from "../../common/android/packageNameResolver";
import {OutputVerifier, PatternToFailure} from "../../common/outputVerifier";
import {FileSystem} from "../../common/node/fileSystem";
import {IReactNative, ReactNative} from "../../common/reactNative";
import {TelemetryHelper} from "../../common/telemetryHelper";


/**
 * Android specific platform implementation for debugging RN applications.
 */
export class AndroidPlatform extends GeneralMobilePlatform {
    private static MULTIPLE_DEVICES_ERROR = "error: more than one device/emulator";

    // We should add the common Android build/run erros we find to this list
    private static RUN_ANDROID_FAILURE_PATTERNS: PatternToFailure = {
        "Failed to install on any devices": "Could not install the app on any available device. Make sure you have a correctly"
         + " configured device or emulator running. See https://facebook.github.io/react-native/docs/android-setup.html",
    "com.android.ddmlib.ShellCommandUnresponsiveException": "An Android shell command timed-out. Please retry the operation.",
    "Android project not found": "Android project not found.",
    "error: more than one device/emulator": AndroidPlatform.MULTIPLE_DEVICES_ERROR,
    };

    private static RUN_ANDROID_SUCCESS_PATTERNS: string[] = ["BUILD SUCCESSFUL", "Starting the app", "Starting: Intent"];

    private debugTarget: IDevice;
    private devices: IDevice[];
    private packageName: string;
    private adb: IAdb;
    private reactNative: IReactNative;
    private fileSystem: FileSystem;

    private needsToLaunchApps: boolean = false;

    // We set remoteExtension = null so that if there is an instance of androidPlatform that wants to have it's custom remoteExtension it can. This is specifically useful for tests.
    constructor(runOptions: IRunOptions, { remoteExtension = null,
        adb = <IAdb>new Adb(),
        reactNative = <IReactNative>new ReactNative(),
        fileSystem = new FileSystem(),
    } = {}) {
        super(runOptions, { remoteExtension: remoteExtension });
        this.adb = adb;
        this.reactNative = reactNative;
        this.fileSystem = fileSystem;
    }

    public runApp(shouldLaunchInAllDevices: boolean = false): Q.Promise<void> {
        return TelemetryHelper.generate("AndroidPlatform.runApp", () => {
            const runAndroidSpawn = this.reactNative.runAndroid(this.runOptions.projectRoot);
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
        return this.remoteExtension.prewarmBundleCache(this.platformName);
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
                    Log.logWarning("Couldn't start LogCat monitor", error));
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
                        Log.logWarning(`Device ${device.id} supports only API Level ${apiVersion}. `
                        + `Level ${AndroidAPILevel.LOLLIPOP} is needed to support port forwarding via adb reverse. `
                        + "For debugging to work you'll need <Shake or press menu button> for the dev menu, "
                        + "go into <Dev Settings> and configure <Debug Server host & port for Device> to be "
                        + "an IP address of your computer that the Device can reach. More info at: "
                        + "https://facebook.github.io/react-native/docs/debugging.html#debugging-react-native-apps");
                    }
                });
        } else {
            return Q<void>(void 0); // Android SDK emulators can connect directly to 10.0.0.2, so they don't need port forwarding
        }
    }

    private getPackageName(): Q.Promise<string> {
        return new Package(this.runOptions.projectRoot, { fileSystem: this.fileSystem }).name().then(appName =>
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
        return this.remoteExtension.startMonitoringLogcat(device.id, logCatArguments);
    }
}