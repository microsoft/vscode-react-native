// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";
import * as assert from "assert";

import * as reactNative from "../../common/reactNative";
import {ISpawnResult} from "../../common/node/childProcess";
import {FileSystem} from "../../common/node/fileSystem";
import {Package} from "../../common/node/package";
import {ProcessExecutionSimulator, IEventArguments} from "./processExecutionSimulator";
import {SimulatedDeviceHelper, IDevice} from "./simulatedDeviceHelper";
import {SimulatedAndroidAPK} from "./simulatedAndroidAPK";

const sampleRNProjectPath = path.join(__dirname, "../../../src/test/resources/myReactNative022Project/");

export type IReactNative = reactNative.IReactNative;

/* This class simulates calling the React-Native CLI v0.22. It currently supports react-native init
    and react-native run-android. The events used in react-native run-android were all generated from
    real executions of the process, so the simulation will be as close as possible to the real cli. */
export class ReactNative022 implements IReactNative {
    private static ANDROID_APK_RELATIVE_PATH = "android/app/build/outputs/apk/app-debug.apk";
    private pathToAndroidSdk = "C:\\Users\\johnny\\AppData\\Local\\Android\\sdk";

    private androidPackageName: string;
    private projectRoot: string;
    private androidAPKPath: string;

    private simulator: ProcessExecutionSimulator;

    private shouldForceUnresponsiveShellError = false;

    constructor(private deviceHelper: SimulatedDeviceHelper, private fileSystem: FileSystem) {
        assert(this.deviceHelper, "deviceHelper shouldn't be null");
        assert(this.fileSystem, "fileSystem shouldn't be null");
    }

    public createProject(projectRoot: string, projectName: string): Q.Promise<void> {
        return Q({})
            .then(() => {
                this.fileSystem.makeDirectoryRecursiveSync(projectRoot);
                return this.readDefaultProjectFile("package.json");
            }).then(defaultContents => {
                const reactNativeConfiguration = JSON.parse(defaultContents);
                reactNativeConfiguration.name = projectName;
                const reactNativeConfigurationFormatted = JSON.stringify(reactNativeConfiguration);
                return this.fileSystem.writeFile(this.getPackageJsonPath(projectRoot), reactNativeConfigurationFormatted);
            }).then(() => {
                return this.fileSystem.mkDir(this.getAndroidProjectPath(projectRoot));
            });
    }

    public runAndroid(projectRoot: string): ISpawnResult {
        this.projectRoot = projectRoot;

        this.simulator = new ProcessExecutionSimulator();

        Q({})
            .then(() => {
                return this.readAndroidPackageName(); // Read application id from package.json
            }).then(() => {
                return this.simulator.simulateAll(this.getsSearchForWhichEvents());
            }).then(() => {
                return this.isAndroidProjectPresent();
            }).then(isAndroidProjectPresent => {
                if (isAndroidProjectPresent) {
                    return Q({})
                        .then(() => {
                            return this.simulateCompilation();
                        }).then(() => {
                            return this.simulateTryInstallingOnDevices();
                        });
                } else {
                    return this.simulator.simulateAll(this.getsAndroidProjectNotFoundEvents());
                }
            }).then(() => {
                return this.simulator.simulateAll(this.getExitEvents()); // Exit the app
            }).fail(reason => {
                console.error(`Error while simulationg React-Native 0.22.0 library: ${reason}\n${reason.stack}`);
            }).done();

        return this.simulator.spawn();
    }

    public forceUnresponsiveShellError(): void {
        this.shouldForceUnresponsiveShellError = true;
    }

    public getSimulatedEvents(): IEventArguments[] {
        return this.simulator.getAllSimulatedEvents();
    }

    private getAndroidProjectPath(projectRoot = this.projectRoot): string {
        return path.join(projectRoot, "android");
    }

    private isAndroidProjectPresent(): Q.Promise<boolean> {
        // TODO: Make more checks as neccesary for the tests
        return this.fileSystem.directoryExists(this.getAndroidProjectPath());
    }

    private simulateCompilation(): Q.Promise<void> {
        return Q({})
            .then(() => {
                return this.simulator.simulateAll(this.getCreateAPKEvents()); // Gradle steps to compile application
            }).then(() => {
                return this.createAPK(); // Generate the APK file
            });
    }

    private simulateTryInstallingOnDevices(): Q.Promise<void> {
        return Q({})
            .then(() => {
                return this.deviceHelper.getConnectedDevices();
            }).then(devices => {
                if (devices.length > 0) {
                    if (!this.shouldForceUnresponsiveShellError) {
                        return this.simulateInstallOnDevicesAndLaunch(); // Install the app in all available devices
                    } else {
                        return this.simulateUnresponsiveShellError();
                    }
                } else {
                    return this.simulateFailedInstallDueToNoDevices();
                }
            });
    }

    private simulateFailedInstallDueToNoDevices(): Q.Promise<void> {
        return this.simulator.simulateAll(this.getFailedInstallDueToNoDevicesEvents()); // We fail because we don't have any devices
    }

    private simulateUnresponsiveShellError(): Q.Promise<void> {
        return this.simulator.simulateAll(this.getUnresponsiveShellErrorEvents());
    }

    private simulateInstallOnDevicesAndLaunch(): Q.Promise<void> {
        return Q({})
            .then(() => {
                return this.installForAllDevices(); // Install the app in all available devices
            }).then(() => {
                return this.simulator.simulateAll(this.getBuildSummaryEvents()); // Finish the gradle/build steps
            }).then(() => {
                return this.deviceHelper.getConnectedDevices();
            }).then(devices => {
                if (devices.length <= 1) {
                    return this.simulator.simulateAll(this.getPrepareToLaunchAppEvents()).then(() => { // Start to launch the app
                        return this.launchApp(); // Actually launch the app
                    });
                } else {
                    return this.simulator.simulateAll(this.getFailLaunchDueToMultipleDevicesEvents()); // Start to launch the app
                }
            });
    }

    private readAndroidPackageName(): Q.Promise<void> {
        return new Package(this.projectRoot, { fileSystem: this.fileSystem}).name().then(name => {
            this.androidPackageName = `com.${name.toLowerCase()}`;
        });
    }

    private getsSearchForWhichEvents(): IEventArguments[] {
        return [
            {after: 2850, stderr: {data: "'which' is not recognized as an internal or external command,\r\noperable program or batch file.\r\n"}}
        ];
    }

    private getsAndroidProjectNotFoundEvents(): IEventArguments[] {
        return [
            { after: 185, stdout: { data: "Android project not found. Maybe run react-native android first?\n"}},
        ];
    }

    private getCreateAPKEvents(): IEventArguments[] {
        return [
                { after: 765, stdout: { data: "JS server already running.\n"}},
                { after: 0, stdout: { data: "Building and installing the app on the device (cd android && gradlew.bat installDebug)...\n"}},
                { after: 4170, stdout: { data: ":app:preBuild"}},
                { after: 21, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 18, stdout: { data: ":app:preDebugBuild"}},
                { after: 0, stdout: { data: " UP-TO-DATE\r\n"}},
                { after: 1, stdout: { data: ":app:checkDebugManifest"}},
                { after: 2, stdout: { data: "\r\n"}},
                { after: 1, stdout: { data: ":app:preReleaseBuild"}},
                { after: 0, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 1, stdout: { data: ":app:prepareComAndroidSupportAppcompatV72301Library"}},
                { after: 105, stdout: { data: " UP-TO-DATE"}},
                { after: 0, stdout: { data: "\r\n"}},
                { after: 0, stdout: { data: ":app:prepareComAndroidSupportRecyclerviewV72301Library"}},
                { after: 4, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 1, stdout: { data: ":app:prepareComAndroidSupportSupportV42301Library"}},
                { after: 5, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 2, stdout: { data: ":app:prepareComFacebookFrescoDrawee081Library"}},
                { after: 2, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 0, stdout: { data: ":app:prepareComFacebookFrescoFbcore081Library"}},
                { after: 4, stdout: { data: " UP-TO-DATE"}},
                { after: 0, stdout: { data: "\r\n"}},
                { after: 0, stdout: { data: ":app:prepareComFacebookFrescoFresco081Library"}},
                { after: 4, stdout: { data: " UP-TO-DATE"}},
                { after: 0, stdout: { data: "\r\n"}},
                { after: 0, stdout: { data: ":app:prepareComFacebookFrescoImagepipeline081Library"}},
                { after: 8, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 1, stdout: { data: ":app:prepareComFacebookFrescoImagepipelineOkhttp081Library"}},
                { after: 3, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 0, stdout: { data: ":app:prepareComFacebookReactReactNative0220Library"}},
                { after: 13, stdout: { data: " UP-TO-DATE"}},
                { after: 0, stdout: { data: "\r\n"}},
                { after: 1, stdout: { data: ":app:prepareOrgWebkitAndroidJscR174650Library"}},
                { after: 3, stdout: { data: " UP-TO-DATE"}},
                { after: 0, stdout: { data: "\r\n"}},
                { after: 1, stdout: { data: ":app:prepareDebugDependencies"}},
                { after: 3, stdout: { data: "\r\n"}},
                { after: 0, stdout: { data: ":app:compileDebugAidl"}},
                { after: 13, stdout: { data: " UP-TO-DATE\r\n"}},
                { after: 1, stdout: { data: ":app:compileDebugRenderscript"}},
                { after: 15, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 1, stdout: { data: ":app:generateDebugBuildConfig"}},
                { after: 40, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 1, stdout: { data: ":app:generateDebugAssets"}},
                { after: 0, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 0, stdout: { data: ":app:mergeDebugAssets"}},
                { after: 15, stdout: { data: " UP-TO-DATE"}},
                { after: 0, stdout: { data: "\r\n"}},
                { after: 0, stdout: { data: ":app:generateDebugResValues"}},
                { after: 3, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 1, stdout: { data: ":app:generateDebugResources"}},
                { after: 0, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 0, stdout: { data: ":app:mergeDebugResources"}},
                { after: 145, stdout: { data: " UP-TO-DATE"}},
                { after: 1, stdout: { data: "\r\n"}},
                { after: 0, stdout: { data: ":app:bundleDebugJsAndAssets"}},
                { after: 0, stdout: { data: " "}},
                { after: 0, stdout: { data: "SKIPPED\r\n"}},
                { after: 0, stdout: { data: ":app:processDebugManifest"}},
                { after: 30, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 0, stdout: { data: ":app:processDebugResources"}},
                { after: 80, stdout: { data: " "}},
                { after: 1, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 1, stdout: { data: ":app:generateDebugSources"}},
                { after: 0, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE"}},
                { after: 0, stdout: { data: "\r\n"}},
                { after: 1, stdout: { data: ":app:processDebugJavaRes"}},
                { after: 1, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 0, stdout: { data: ":app:compileDebugJavaWithJavac"}},
                { after: 39, stdout: { data: " UP-TO-DATE"}},
                { after: 0, stdout: { data: "\r\n"}},
                { after: 0, stdout: { data: ":app:compileDebugNdk"}},
                { after: 1, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 0, stdout: { data: ":app:compileDebugSources"}},
                { after: 1, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 1, stdout: { data: ":app:preDexDebug"}},
                { after: 14, stdout: { data: " "}},
                { after: 1, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 0, stdout: { data: ":app:dexDebug"}},
                { after: 27, stdout: { data: " "}},
                { after: 1, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 0, stdout: { data: ":app:validateDebugSigning"}},
                { after: 2, stdout: { data: "\r\n"}},
                { after: 0, stdout: { data: ":app:packageDebug"}},
                { after: 30, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 0, stdout: { data: ":app:zipalignDebug"}},
                { after: 4, stdout: { data: " "}},
                { after: 0, stdout: { data: "UP-TO-DATE\r\n"}},
                { after: 0, stdout: { data: ":app:assembleDebug"}},
                { after: 0, stdout: {data: " "}},
                { after: 0, stdout: {data: "UP-TO-DATE\r\n"}}
        ];
    }

    private createAPK(): Q.Promise<void> {
        this.androidAPKPath = path.join(this.projectRoot, ReactNative022.ANDROID_APK_RELATIVE_PATH);
        return new SimulatedAndroidAPK(this.fileSystem).writeApk(this.androidAPKPath, { packageName: this.androidPackageName });
    }

    private getUnresponsiveShellErrorEvents(): IEventArguments[] {
        return [
            {after: 0, stdout: { data: ":app:installDebug"}},
            {after: 9105, stdout: { data: " FAILED\n"}},
            {after: 54, stderr: { data: "\n"}},
            {after: 0, stderr: { data: "FAILURE: Build failed with an exception.\n\n* What went wrong:\nExecution failed for task ':app:installDebug'.\n"}},
            {after: 0, stderr: { data: "> com.android.builder.testing.api.DeviceException: com.android.ddmlib.ShellCommandUnresponsiveException\n"}},
            {after: 0, stderr: { data: "\n* Try:\n"}},
            {after: 0, stderr: { data: "Run with "}},
            {after: 0, stderr: { data: "--stacktrace option to get the stack trace. Run with --info or --debug option to get more log output.\n"}},
            {after: 1, stdout: { data: "\n"}},
            {after: 0, stdout: { data: "BUILD FAILED\n"}},
            {after: 0, stdout: { data: "\n"}},
            {after: 0, stdout: { data: "Total time: 1 mins 30.384 secs\n"}},
            {after: 546, stdout: { data: "Could not install the app on the device, read the error above for details.\nMake sure you have an Android emulator running or a device connected and have\nset up your Android development environment:\nhttps://facebook.github.io/react-native/docs/android-setup.html\n"}},
        ];
    }

    private getFailedInstallDueToNoDevicesEvents(): IEventArguments[] {
        return [
            {after: 1075, stdout: {data: " "}},
            {after: 1, stdout: {data: "FAILED\r\n"}},
            {after: 6, stderr: {data: "\r\n"}},
            {after: 1, stderr: {data: "FAILURE: Build failed with an exception.\r\n\r\n"
                + "* What went wrong:\r\nExecution failed for task ':app:installDebug'.\r\n"
                + "> com.android.builder.testing.api.DeviceException: No connected devices!\r\n\r\n* Try:\r\n"
                + "Run with --stacktrace option to get the stack trace. Run with --info or --debug option to get more log output.\r\n"}},
            {after: 0, stdout: {data: "\r\n"}},
            {after: 0, stdout: {data: "BUILD FAILED\r\n\r\nTotal time: 6.292 secs\r\n"}},
            {after: 365, stderr: {data: "Picked up _JAVA_OPTIONS: -Xmx512M\n"}},
            {after: 45, stdout: {data: "Could not install the app on the device, read the error above for details.\n"
                + "Make sure you have an Android emulator running or a device connected and have\n"
                + "set up your Android development environment:\nhttps://facebook.github.io/react-native/docs/android-setup.html\n"}}
        ];
    }

    private installForAllDevices(): Q.Promise<void> {
        return Q({})
            .then(() => {
                this.simulator.simulateAll(this.getInstallAppSectionStartEvents());
            }).then(() => {
                return this.deviceHelper.getConnectedDevices();
            }).then(devices => {
                let installations = Q.resolve<void>(void 0);
                this.simulator.simulateAll(this.getStartListingDevicesEvents());
                devices.forEach(device => {
                    installations = installations.then(() => this.simulateInstallApp(device.id));
                });

                return installations.then(() =>
                    this.simulator.simulateAll(this.getInstallAppSectionSummaryEvents(devices)));
            });
    }

    private getInstallAppSectionStartEvents(): IEventArguments[] {
        return [
            {after: 0, stdout: {data: ":app:installDebug"}}
        ];
    }

    private getStartListingDevicesEvents(): IEventArguments[] {
        return [
            { after: 9995, stdout: { data: "\r\n"}}
        ];
    }

    private simulateInstallApp(deviceId: string): Q.Promise<void> {
        const installingAPKEvents = [
            // TODO: Print the proper information for each individual device
            { after: 9995, stdout: { data: "Installing APK 'app-debug.apk' on '5\" Marshmallow (6.0.0) XHDPI Phone - 6.0'\r\n"}},
        ];

        return this.simulator.simulateAll(installingAPKEvents).then(() =>
            this.installApp(deviceId));
    }

    private installApp(deviceId: string): Q.Promise<void> {
        return this.deviceHelper.isDeviceOnline(deviceId).then(isOnline => {
            if (isOnline) {
                return this.deviceHelper.installApp(this.androidAPKPath, deviceId);
            } else {
                // TODO: Figure out what's the right thing to do here
            }
        });
    }

    private getInstallAppSectionSummaryEvents(devices: IDevice[]): IEventArguments[] {
        const devicesCount = devices.length;
        return [
            { after: 12357, stdout: { data: devices.length === 1
                ? "Installed on 1 device.\r\n"
                : `Installed on ${devicesCount} devicess.` }
            }
        ];
    }

    private getBuildSummaryEvents(): IEventArguments[] {
        return [
            { after: 12373, stdout: { data: "\r\n"}},
            { after: 12373, stdout: { data: "BUILD SUCCESSFUL\r\n"}},
            { after: 12373, stdout: { data: "\r\nTotal time: 9.023 secs\r\n"}},
        ];
    }

    private getPrepareToLaunchAppEvents(): IEventArguments[] {
        return [
            { after: 12889, stderr: { data: "Picked up _JAVA_OPTIONS: -Xmx512M\n"}},
            { after: 12947, stdout: { data: `Starting the app (${this.pathToAndroidSdk}/platform-tools/adb shell am start -n com.sampleapplication/.MainActivity)...\n`}},
            { after: 13109, stdout: { data: `Starting: Intent { cmp=${this.androidPackageName}/.MainActivity }\r\r\n`}}
        ];
    }

    private launchApp(): void {
        this.deviceHelper.launchApp(this.projectRoot, this.androidPackageName);
    }

    private getExitEvents(): IEventArguments[] {
        return [
            {after: 740, exit: {code: 0}}
        ];
    }

    private getFailLaunchDueToMultipleDevicesEvents(): IEventArguments[] {
        return [
            { after: 14158, stderr: { data: "Picked up _JAVA_OPTIONS: -Xmx512M\n" } },
            { after: 12947, stdout: { data: `Starting the app (${this.pathToAndroidSdk}/platform-tools/adb shell am start -n com.sampleapplication/.MainActivity)...\n`}},
            { after: 14220, stderr: { data: "error: " } },
            { after: 14221, stderr: { data: "more than one device/emulator\r\n" } },
            { after: 14959, exit: { code: 0 } }
        ];
    }

    private readDefaultProjectFile(relativeFilePath: string): Q.Promise<string> {
        const realFileSystem = new FileSystem(); // We always use the real file system (not the mock one) to read the sample project
        return realFileSystem.readFile(path.join(sampleRNProjectPath, relativeFilePath));
    }

    private getPackageJsonPath(projectRoot: string): string {
        return new Package(projectRoot, { fileSystem: this.fileSystem} ).informationJsonFilePath();
    }
 }
