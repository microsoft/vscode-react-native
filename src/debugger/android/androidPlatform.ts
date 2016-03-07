// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {IAppPlatform} from "../platformResolver";
import {CommandExecutor} from "../../common/commandExecutor";
import {ExtensionMessageSender, ExtensionMessage} from "../../common/extensionMessaging";
import {IRunOptions} from "../../common/launchArgs";
import {Log} from "../../common/log/log";
import {PackageNameResolver} from "../../common/android/packageNameResolver";
import {OutputVerifier, PatternToFailure} from "../../common/outputVerifier";
import {DeviceHelper, IDevice} from "../../common/android/deviceHelper";
import {Package} from "../../common/node/package";

/**
 * Android specific platform implementation for debugging RN applications.
 */
export class AndroidPlatform implements IAppPlatform {
    private extensionMessageSender: ExtensionMessageSender;

    // We should add the common Android build/run erros we find to this list
    private static RUN_ANDROID_FAILURE_PATTERNS: PatternToFailure = {
        "Failed to install on any devices": "Could not install the app on any available device. Make sure you have a correctly"
         + " configured device or emulator running. See https://facebook.github.io/react-native/docs/android-setup.html",
    "com.android.ddmlib.ShellCommandUnresponsiveException": "An Android shell command timed-out. Please retry the operation.",
    "Android project not found": "Android project not found." };

    private static RUN_ANDROID_SUCCESS_PATTERNS: string[] = ["BUILD SUCCESSFUL", "Starting the app", "Starting: Intent"];

    private debugTarget: string;
    private packageName: string;
    private deviceHelper: DeviceHelper;

    constructor({ extensionMessageSender = new ExtensionMessageSender()} = {}) {
        this.extensionMessageSender = extensionMessageSender;
        this.deviceHelper = new DeviceHelper();
    }

    public runApp(runOptions: IRunOptions): Q.Promise<void> {
        let pkg = new Package(runOptions.projectRoot);
        let cexec = new CommandExecutor(runOptions.projectRoot);

        const runAndroidSpawn = cexec.spawnChildReactCommandProcess("run-android");
        const output = new OutputVerifier(
            () =>
                Q(AndroidPlatform.RUN_ANDROID_SUCCESS_PATTERNS),
            () =>
                Q(AndroidPlatform.RUN_ANDROID_FAILURE_PATTERNS)).process(runAndroidSpawn);

        return output
            .then(() => pkg.name())
            .then(appName => new PackageNameResolver(appName).resolvePackageName(runOptions.projectRoot))
            .then(packageName => {
                this.packageName = packageName;
                return this.deviceHelper.getConnectedDevices()
                    .then((devices: IDevice[]) => {
                        if (devices.length > 1) {
                            /* more than one device or emulator */
                            this.debugTarget = this.getTargetEmulator(runOptions, devices);
                            if (this.debugTarget) {
                                /* Launching is needed only if we have more than one device active */
                                return this.deviceHelper.launchApp(runOptions.projectRoot, packageName, this.debugTarget);
                            }
                        } else if (devices.length === 1) {
                            this.debugTarget = devices[0].id;
                        }
                    });
            }).then(() =>
                this.startMonitoringLocat(runOptions.logCatArguments).catch(error => // The LogCatMonitor failing won't stop the debugging experience
                    Log.logWarning("Couldn't start LogCat monitor", error)));
    }

    public enableJSDebuggingMode(runOptions: IRunOptions): Q.Promise<void> {
        return this.deviceHelper.reloadAppInDebugMode(runOptions.projectRoot, this.packageName, this.debugTarget);
    }

    /**
     * Returns the target emulator, using the following logic:
     * *  If an emulator is specified and it is connected, use that one.
     * *  Otherwise, use the first one in the list.
     */
    private getTargetEmulator(runOptions: IRunOptions, devices: IDevice[]): string {
        let activeFilterFunction = (device: IDevice) => {
            return device.isOnline;
        };

        let targetFilterFunction = (device: IDevice) => {
            return device.id === runOptions.target && activeFilterFunction(device);
        };

        if (runOptions && runOptions.target && devices) {
            /* check if the specified target is active */
            if (devices.some(targetFilterFunction)) {
                return runOptions.target;
            }
        }

        /* return the first active device in the list */
        let activeDevices = devices && devices.filter(activeFilterFunction);
        return activeDevices && activeDevices[0] && activeDevices[0].id;
    }

    private startMonitoringLocat(logCatArguments: string): Q.Promise<void> {
        return this.extensionMessageSender.sendMessage(ExtensionMessage.START_MONITORING_LOGCAT, [this.debugTarget, logCatArguments]);
    }
}