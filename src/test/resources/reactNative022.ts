// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";
import * as assert from "assert";

import {PromiseUtil} from "../../common/node/promise";

import * as reactNative from "../../common/reactNative";
import {ISpawnResult} from "../../common/node/childProcess";
import {FileSystem} from "../../common/node/fileSystem";
import {Package} from "../../common/node/package";
import {Recording, Simulator} from "./processExecution/simulator";
import {DeviceHelper} from "./simulators/deviceHelper";
import {APKSerializer} from "./simulators/apkSerializer";

const resourcesPath = path.join(__dirname, "../../../src/test/resources/");
const sampleRNProjectPath = path.join(resourcesPath, "sampleReactNative022Project");
const processExecutionsRecordingsPath = path.join(resourcesPath, "processExecutionsRecordings");

export type IReactNative = reactNative.IReactNative;

/* This class simulates calling the React-Native CLI v0.22. It currently supports react-native init
    and react-native run-android. */
export class ReactNative022 implements IReactNative {
    private static ANDROID_APK_RELATIVE_PATH = "android/app/build/outputs/apk/app-debug.apk";

    private simulator: Simulator = new Simulator({
        beforeStart: () => this.readAndroidPackageName(), // 1. We read the package.json to verify this is a RN project
        outputBased: [
            {
                eventPattern: /:app:assembleDebug/,
                action: () => this.createAPK(), // 2. We compile the application.
            },
            {
                eventPattern: /Installed on [0-9]+ devices*\./,
                action: () => this.installAppInAllDevices(), // 3. We install it on all available devices.
            },
        ],
        beforeSuccess: (stdout: string, stderr: string) => // 4. If we didn't had any errors after starting to launch the app,
            this.launchApp(stdout, stderr),                // it means we were succesful
    });

    private recording: Recording;

    private androidPackageName: string;
    private projectRoot: string;
    private androidAPKPath: string;

    constructor(private deviceHelper: DeviceHelper, private fileSystem: FileSystem) {
        assert(this.deviceHelper, "deviceHelper shouldn't be null");
        assert(this.fileSystem, "fileSystem shouldn't be null");
    }

    public loadRecordingFromName(recordingName: string): Q.Promise<void> {
        return this.loadRecordingFromFile(path.join(processExecutionsRecordingsPath, `${recordingName}.json`));
    }

    public loadRecordingFromFile(recordingPath: string): Q.Promise<void> {
        return Q({})
            .then(() => {
                return new FileSystem().readFile(recordingPath);
            }).then(fileContents => {
                this.loadRecording(JSON.parse(fileContents));
            });
    }

    public loadRecording(recording: Recording): void {
        assert(recording, "recording shouldn't be null");
        this.recording = recording;
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
        this.simulator.simulate(this.recording).done();
        return this.simulator.spawn();
    }

    private getAndroidProjectPath(projectRoot = this.projectRoot): string {
        return path.join(projectRoot, "android");
    }

    private getPackageJsonPath(projectRoot: string): string {
        return new Package(projectRoot, { fileSystem: this.fileSystem }).informationJsonFilePath();
    }

    private readAndroidPackageName(): Q.Promise<void> {
        return new Package(this.projectRoot, { fileSystem: this.fileSystem }).name().then(name => {
            this.androidPackageName = `com.${name.toLowerCase()}`;
        });
    }

    private createAPK(): Q.Promise<void> {
        return this.isAndroidProjectPresent().then(isPresent => {
            if (!isPresent) {
                return Q.reject<void>(new Error("The recording expects the Android project to be present, but it's not"));
            }
        }).then(() => {
            this.androidAPKPath = path.join(this.projectRoot, ReactNative022.ANDROID_APK_RELATIVE_PATH);
            return new APKSerializer(this.fileSystem).writeApk(this.androidAPKPath, { packageName: this.androidPackageName });
        });
    }

    private isAndroidProjectPresent(): Q.Promise<boolean> {
        // TODO: Make more checks as neccesary for the tests
        return this.fileSystem.directoryExists(this.getAndroidProjectPath());
    }

    private installAppInAllDevices(): Q.Promise<void> {
        return new PromiseUtil().reduce(this.deviceHelper.getConnectedDevices(), device => this.installAppInDevice(device.id));
    }

    private installAppInDevice(deviceId: string): Q.Promise<void> {
        return this.deviceHelper.isDeviceOnline(deviceId).then(isOnline => {
            if (isOnline) {
                return this.deviceHelper.installApp(this.androidAPKPath, deviceId);
            } else {
                // TODO: Figure out what's the right thing to do here, if we ever need this for the tests
            }
        });
    }

    private launchApp(stdout: string, stderr: string): Q.Promise<void> {
        /*
        Sample output we want to accept:
        BUILD SUCCESSFUL

        Total time: 9.052 secs
        Starting the app (C:\Program Files (x86)\Android\android-sdk/platform-tools/adb shell am start -n com.sampleapplication/.MainActivity)...
        Starting: Intent { cmp=com.sampleapplication/.MainActivity }


        Sample output we don't to accept:
        BUILD SUCCESSFUL

        Total time: 9.052 secs
        Starting the app (C:\Program Files (x86)\Android\android-sdk/platform-tools/adb shell am start -n com.sampleapplication/.MainActivity)...
        Starting: Intent { cmp=com.sampleapplication/.MainActivity }
        Error: some error happened
        **/
        const succesfulOutputEnd = `Starting the app \\(.*adb shell am start -n ([^ /]+)\/\\.MainActivity\\)\\.\\.\\.\\s+`
            + `Starting: Intent { cmp=([^ /]+)\/\\.MainActivity }\\s+$`;
        const matches = stdout.match(new RegExp(succesfulOutputEnd));
        if (matches) {
            if (matches.length === 3 && matches[1] === this.androidPackageName && matches[2] === this.androidPackageName) {
                return this.deviceHelper.launchApp(this.projectRoot, this.androidPackageName);
            } else {
                return Q.reject<void>(new Error("There was an error while trying to match the Starting the app messages."
                    + "Expected to match the pattern and recognize the expected android package name, but it failed."
                    + `Expected android package name: ${this.androidPackageName}. Actual matches: ${JSON.stringify(matches)}`));
            }
        } else {
            // The record doesn't indicate that the app was launched, so we don't do anything
        }
    }

    private readDefaultProjectFile(relativeFilePath: string): Q.Promise<string> {
        const realFileSystem = new FileSystem(); // We always use the real file system (not the mock one) to read the sample project
        return realFileSystem.readFile(path.join(sampleRNProjectPath, relativeFilePath));
    }
}
