// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as assert from "assert";
import { PromiseUtil } from "../../src/common/node/promise";
import { IAndroidRunOptions } from "../../src/extension/launchArgs";
import { ISpawnResult } from "../../src/common/node/childProcess";
import { FileSystem } from "../../src/common/node/fileSystem";
import { Package } from "../../src/common/node/package";
import { Recording, Simulator } from "./processExecution/simulator";
import { AdbHelper } from "../../src/extension/android/adb";
import { APKSerializer } from "./simulators/apkSerializer";

const sampleRNProjectPath = path.join(__dirname, "sampleReactNative022Project");
const processExecutionsRecordingsPath = path.join(__dirname, "processExecutionsRecordings");

/* This class simulates calling the React-Native CLI v0.22. It currently supports react-native init
    and react-native run-android. */
export class ReactNative022 {
    public static DEFAULT_PROJECT_FILE = path.join(sampleRNProjectPath, "package.json");

    private static ANDROID_APK_RELATIVE_PATH = "android/app/build/outputs/apk/app-debug.apk";

    private projectFileContent: string;

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
        beforeSuccess: (
            stdout: string,
            stderr: string, // 4. If we didn't had any errors after starting to launch the app,
        ) => this.launchApp(stdout, stderr), // it means we were succesful
    });

    private recording: Recording;

    private androidPackageName: string;
    private projectRoot: string;
    private androidAPKPath: string;

    constructor(private fileSystem: FileSystem, private adbHelper: AdbHelper) {
        assert(this.fileSystem, "fileSystem shouldn't be null");
    }

    public fromProjectFileContent(content: string): this {
        this.projectFileContent = content;
        return this;
    }

    public loadRecordingFromName(recordingName: string): Promise<void> {
        return this.loadRecordingFromFile(
            path.join(processExecutionsRecordingsPath, `${recordingName}.json`),
        );
    }

    public loadRecordingFromString(recordingContent: string): Promise<void> {
        return Promise.resolve(this.loadRecording(JSON.parse(recordingContent)));
    }

    public loadRecordingFromFile(recordingPath: string): Promise<void> {
        return new FileSystem().readFile(recordingPath).then(fileContents => {
            this.loadRecording(JSON.parse(fileContents.toString()));
        });
    }

    public loadRecording(recording: Recording): void {
        assert(recording, "recording shouldn't be null");
        this.recording = recording;
    }

    public createProject(projectRoot: string, projectName: string): Promise<void> {
        return Promise.resolve()
            .then(() => {
                this.fileSystem.makeDirectoryRecursiveSync(projectRoot);
                return this.projectFileContent !== undefined
                    ? this.projectFileContent
                    : this.readDefaultProjectFile();
            })
            .then(defaultContents => {
                const reactNativeConfiguration = JSON.parse(defaultContents.toString());
                reactNativeConfiguration.name = projectName;
                const reactNativeConfigurationFormatted = JSON.stringify(reactNativeConfiguration);
                return this.fileSystem.writeFile(
                    this.getPackageJsonPath(projectRoot),
                    reactNativeConfigurationFormatted,
                );
            })
            .then(() => {
                return this.fileSystem.mkDir(this.getAndroidProjectPath(projectRoot));
            });
    }

    public runAndroid(runOptions: IAndroidRunOptions): ISpawnResult {
        this.projectRoot = runOptions.projectRoot;
        this.simulator.simulate(this.recording).then(() => {});
        return this.simulator.spawn();
    }

    private getAndroidProjectPath(projectRoot = this.projectRoot): string {
        return path.join(projectRoot, "android");
    }

    private getPackageJsonPath(projectRoot: string): string {
        return new Package(projectRoot, { fileSystem: this.fileSystem }).informationJsonFilePath();
    }

    private readAndroidPackageName(): Promise<void> {
        return new Package(this.projectRoot, { fileSystem: this.fileSystem }).name().then(name => {
            this.androidPackageName = `com.${name.toLowerCase()}`;
        });
    }

    private createAPK(): Promise<void> {
        return this.isAndroidProjectPresent()
            .then(isPresent => {
                return isPresent
                    ? void 0
                    : Promise.reject<void>(
                          new Error(
                              "The recording expects the Android project to be present, but it's not",
                          ),
                      );
            })
            .then(() => {
                this.androidAPKPath = path.join(
                    this.projectRoot,
                    ReactNative022.ANDROID_APK_RELATIVE_PATH,
                );
                return new APKSerializer(this.fileSystem).writeApk(this.androidAPKPath, {
                    packageName: this.androidPackageName,
                });
            });
    }

    private isAndroidProjectPresent(): Promise<boolean> {
        // TODO: Make more checks as neccesary for the tests
        return this.fileSystem.directoryExists(this.getAndroidProjectPath());
    }

    private installAppInAllDevices(): Promise<void> {
        let devices = this.adbHelper.getConnectedDevices();
        return PromiseUtil.reduce(devices, device => this.installAppInDevice(device.id));
    }

    private installAppInDevice(deviceId: string): Promise<void> {
        throw Error("Mock not implemented");
    }

    private launchApp(stdout: string, stderr: string): Promise<void> {
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
        const succesfulOutputEnd =
            `Starting the app \\(.*adb shell am start -n ([^ /]+)\/\\.MainActivity\\)\\.\\.\\.\\s+` +
            `Starting: Intent { cmp=([^ /]+)\/\\.MainActivity }\\s+$`;
        const matches = stdout.match(new RegExp(succesfulOutputEnd));
        if (matches) {
            if (
                matches.length === 3 &&
                matches[1] === this.androidPackageName &&
                matches[2] === this.androidPackageName
            ) {
                return this.adbHelper.launchApp(this.projectRoot, this.androidPackageName);
            } else {
                return Promise.reject<void>(
                    new Error(
                        "There was an error while trying to match the Starting the app messages." +
                            "Expected to match the pattern and recognize the expected android package name, but it failed." +
                            `Expected android package name: ${
                                this.androidPackageName
                            }. Actual matches: ${JSON.stringify(matches)}`,
                    ),
                );
            }
        } else {
            // The record doesn't indicate that the app was launched, so we don't do anything
            return Promise.resolve();
        }
    }

    private readDefaultProjectFile(): Promise<string | Buffer> {
        const realFileSystem = new FileSystem(); // We always use the real file system (not the mock one) to read the sample project
        return realFileSystem.readFile(ReactNative022.DEFAULT_PROJECT_FILE);
    }
}
