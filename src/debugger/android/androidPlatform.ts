// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {IAppPlatform} from "../platformResolver";
import {RemoteExtension} from "../../common/remoteExtension";
import {IRunOptions} from "../../common/launchArgs";
import {Log} from "../../common/log/log";
import {PackageNameResolver} from "../../common/android/packageNameResolver";
import {OutputVerifier, PatternToFailure} from "../../common/outputVerifier";
import {IDeviceHelper, DeviceHelper, IDevice} from "../../common/android/deviceHelper";
import {Package} from "../../common/node/package";
import {FileSystem} from "../../common/node/fileSystem";
import {IReactNative, ReactNative} from "../../common/reactNative";

/**
 * Android specific platform implementation for debugging RN applications.
 */
export class AndroidPlatform implements IAppPlatform {
    private remoteExtension: RemoteExtension;

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

    private debugTarget: string;
    private devices: IDevice[];
    private packageName: string;
    private deviceHelper: IDeviceHelper;
    private reactNative: IReactNative;
    private fileSystem: FileSystem;

    constructor(private runOptions: IRunOptions, {
        remoteExtension = new RemoteExtension(runOptions.projectRoot),
        deviceHelper = <IDeviceHelper>new DeviceHelper(),
        reactNative = <IReactNative>new ReactNative(),
        fileSystem = new FileSystem(),
    } = {}) {
        this.remoteExtension = remoteExtension;
        this.deviceHelper = deviceHelper;
        this.reactNative = reactNative;
        this.fileSystem = fileSystem;
    }

    public runApp(): Q.Promise<void> {
        const runAndroidSpawn = this.reactNative.runAndroid(this.runOptions.projectRoot);
        const output = new OutputVerifier(
            () =>
                Q(AndroidPlatform.RUN_ANDROID_SUCCESS_PATTERNS),
            () =>
                Q(AndroidPlatform.RUN_ANDROID_FAILURE_PATTERNS)).process(runAndroidSpawn);

        return output
            .finally(() => {
                return this.deviceHelper.getConnectedDevices().then(devices => {
                    this.devices = devices;
                    this.debugTarget = this.getTargetEmulator(devices);
                    return this.getPackageName(this.runOptions.projectRoot).then(packageName =>
                        this.packageName = packageName);
                });
            }).catch(reason => {
                if (reason.message === AndroidPlatform.MULTIPLE_DEVICES_ERROR && this.devices.length > 1 && this.debugTarget) {
                    /* If it failed due to multiple devices, we'll apply this workaround to make it work anyways */
                    return this.deviceHelper.launchApp(this.runOptions.projectRoot, this.packageName, this.debugTarget);
                } else {
                    return Q.reject<void>(reason);
                }
            }).then(() =>
                this.startMonitoringLogCat(this.runOptions.logCatArguments).catch(error => // The LogCatMonitor failing won't stop the debugging experience
                    Log.logWarning("Couldn't start LogCat monitor", error)));
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        return this.deviceHelper.reloadAppInDebugMode(this.runOptions.projectRoot, this.packageName, this.debugTarget);
    }

    private getPackageName(projectRoot: string): Q.Promise<string> {
        return new Package(projectRoot, { fileSystem: this.fileSystem }).name().then(appName =>
                new PackageNameResolver(appName).resolvePackageName(projectRoot));
    }

    /**
     * Returns the target emulator, using the following logic:
     * *  If an emulator is specified and it is connected, use that one.
     * *  Otherwise, use the first one in the list.
     */
    private getTargetEmulator(devices: IDevice[]): string {
        let activeFilterFunction = (device: IDevice) => {
            return device.isOnline;
        };

        let targetFilterFunction = (device: IDevice) => {
            return device.id === this.runOptions.target && activeFilterFunction(device);
        };

        if (this.runOptions && this.runOptions.target && devices) {
            /* check if the specified target is active */
            if (devices.some(targetFilterFunction)) {
                return this.runOptions.target;
            }
        }

        /* return the first active device in the list */
        let activeDevices = devices && devices.filter(activeFilterFunction);
        return activeDevices && activeDevices[0] && activeDevices[0].id;
    }

    private startMonitoringLogCat(logCatArguments: string): Q.Promise<void> {
        return this.remoteExtension.startMonitoringLogcat(this.debugTarget, logCatArguments);
    }
}