// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as assert from "assert";
import { AndroidPlatform } from "../../../src/extension/android/androidPlatform";
import { IAndroidRunOptions, PlatformType } from "../../../src/extension/launchArgs";
import { FileSystem } from "../../../src/common/node/fileSystem";
import { ReactNative022 } from "../../resources/reactNative022";
import * as adb from "../../../src/extension/android/adb";
import { RecordingsHelper } from "../../resources/recordingsHelper";
import { CommandExecutor } from "../../../src/common/commandExecutor";
import { ProjectVersionHelper } from "../../../src/common/projectVersionHelper";
import * as rimraf from "rimraf";
import "should";
import * as sinon from "sinon";
import { SettingsHelper } from "../../../src/extension/settingsHelper";

suite("androidPlatform", function () {
    suite("extensionContext", function () {
        const projectRoot = path.join(
            __dirname,
            "..",
            "..",
            "resources",
            "projects",
            "SampleApplication_21",
        );
        const projectsFolder = path.join(projectRoot, "..");
        const androidProjectPath = path.join(projectRoot, "android");
        const applicationName = "SampleApplication";
        const androidPackageName = "com.sampleapplication";

        const nodeModulesRoot: string = projectRoot;
        const genericRunOptions: IAndroidRunOptions = {
            platform: PlatformType.Android,
            workspaceRoot: projectRoot,
            projectRoot,
            reactNativeVersions: {
                reactNativeVersion: "^0.19.0",
                reactNativeWindowsVersion: "",
                reactNativeMacOSVersion: "",
            },
            nodeModulesRoot,
        };

        const rnProjectContent = fs.readFileSync(ReactNative022.DEFAULT_PROJECT_FILE, "utf8");

        let fileSystem: FileSystem;
        let reactNative: ReactNative022;
        let androidPlatform: AndroidPlatform;

        let launchAppStub: Sinon.SinonStub;
        let getConnectedTargetsStub: Sinon.SinonStub;
        let getOnlineTargetsStub: Sinon.SinonStub;
        let apiVersionStub: Sinon.SinonStub;
        let reverseAdbStub: Sinon.SinonStub;
        let getReactNativeProjectRootStub: Sinon.SinonStub;
        let spawnReactCommandStub: Sinon.SinonStub;
        let getReactNativeVersionsStub: Sinon.SinonStub;
        let installAppInDeviceStub: Sinon.SinonStub;

        let devices: any;
        let adbHelper: adb.AdbHelper;

        function createAndroidPlatform(runOptions: IAndroidRunOptions): AndroidPlatform {
            return new AndroidPlatform(runOptions);
        }

        setup(() => {
            // Configure all the dependencies we'll use in our tests
            fileSystem = new FileSystem();

            adbHelper = new adb.AdbHelper(genericRunOptions.projectRoot, nodeModulesRoot);
            launchAppStub = sinon.stub(
                adbHelper,
                "launchApp",
                async (projectRoot_: string, packageName: string, debugTarget?: string) => {
                    devices = devices.map((device: any) => {
                        if (!debugTarget) {
                            device.installedApplications[androidPackageName] = {
                                isInDebugMode: false,
                            };
                        }

                        if (debugTarget && debugTarget === device.id) {
                            device.installedApplications[androidPackageName] = {
                                isInDebugMode: false,
                            };
                        }

                        return device;
                    });
                },
            );
            getConnectedTargetsStub = sinon.stub(
                adbHelper,
                "getConnectedTargets",
                async function () {
                    return devices;
                },
            );
            getOnlineTargetsStub = sinon.stub(adbHelper, "getOnlineTargets", async function () {
                return devices.filter((device: any) => {
                    return device.isOnline;
                });
            });
            apiVersionStub = sinon.stub(adbHelper, "apiVersion", async function () {
                return adb.AndroidAPILevel.LOLLIPOP;
            });
            reverseAdbStub = sinon.stub(adbHelper, "reverseAdb", async function () {
                return;
            });

            reactNative = new ReactNative022(fileSystem, adbHelper);

            getReactNativeProjectRootStub = sinon.stub(
                SettingsHelper,
                "getReactNativeProjectRoot",
                () => projectRoot,
            );

            androidPlatform = createAndroidPlatform(genericRunOptions);

            spawnReactCommandStub = sinon.stub(
                CommandExecutor.prototype,
                "spawnReactCommand",
                function () {
                    return reactNative.runAndroid(genericRunOptions);
                },
            );

            getReactNativeVersionsStub = sinon.stub(
                ProjectVersionHelper,
                "getReactNativeVersions",
                async function () {
                    return {
                        reactNativeVersion: "0.0.1",
                        reactNativeWindowsVersion: "",
                    };
                },
            );

            (androidPlatform as any).adbHelper = adbHelper;

            installAppInDeviceStub = sinon.stub(
                reactNative,
                "installAppInDevice",
                async function (deviceId: string) {
                    devices = devices.map((device: any) => {
                        if (deviceId && deviceId === device.id) {
                            device.installedApplications[androidPackageName] = {};
                        }

                        return device;
                    });
                },
            );

            // Delete existing React Native project before creating
            rimraf.sync(projectsFolder);
            // Create a React-Native project we'll use in our tests
            return reactNative
                .fromProjectFileContent(rnProjectContent)
                .createProject(projectRoot, applicationName);
        });

        teardown(() => {
            // Delete existing React Native project after each test
            rimraf.sync(projectsFolder);
            launchAppStub.restore();
            getConnectedTargetsStub.restore();
            getOnlineTargetsStub.restore();
            apiVersionStub.restore();
            reverseAdbStub.restore();
            getReactNativeProjectRootStub.restore();
            spawnReactCommandStub.restore();
            getReactNativeVersionsStub.restore();
            installAppInDeviceStub.restore();
            devices = [];
        });

        const testWithRecordings = new RecordingsHelper(() => reactNative).test;

        testWithRecordings(
            "runApp launches the app when a single emulator is connected",
            [
                "react-native/run-android/win10-rn0.21.0/succeedsWithOneVSEmulator",
                "react-native/run-android/win10-rn0.22.2/succeedsWithOneVSEmulator",
                "react-native/run-android/osx10.10-rn0.21.0/succeedsWithOneVSEmulator",
            ],
            async () => {
                devices = fillDevices(["Nexus_5"]);

                await androidPlatform.runApp();
                const isRunning =
                    devices[0].installedApplications[androidPackageName].isInDebugMode === false;
                isRunning.should.be.true();
            },
        );

        testWithRecordings(
            "runApp launches the app when two emulators are connected",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithTwoVSEmulators"],
            async () => {
                devices = fillDevices(["Nexus_5", "Nexus_6"]);

                await androidPlatform.runApp();
                const [isRunningOnNexus5, isRunningOnNexus6] = [
                    devices[0].installedApplications[androidPackageName].isInDebugMode === false,
                    devices[1].installedApplications[androidPackageName].isInDebugMode === false,
                ];
                // It should be running in exactly one of these two devices
                isRunningOnNexus5.should.not.eql(isRunningOnNexus6);
            },
        );

        testWithRecordings(
            "runApp launches the app when three emulators are connected",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithThreeVSEmulators"],
            async () => {
                devices = fillDevices(["Nexus_5", "Nexus_6", "Nexus_7"]);

                await androidPlatform.runApp();
                const isRunningList = [
                    devices[0].installedApplications[androidPackageName].isInDebugMode === false,
                    devices[1].installedApplications[androidPackageName].isInDebugMode === false,
                    devices[2].installedApplications[androidPackageName].isInDebugMode === false,
                ];
                // It should be running in exactly one of these three devices
                isRunningList.filter(v => v).should.eql([true]);
            },
        );

        testWithRecordings(
            "runApp fails if no devices are connected",
            ["react-native/run-android/win10-rn0.21.0/failsDueToNoDevicesConnected"],
            async () => {
                try {
                    await androidPlatform.runApp();
                    should.assert(false, "runApp should've exited with an error");
                } catch (error) {
                    error.message
                        .startsWith("There is no any Android debuggable online target")
                        .should.be.true();
                }
            },
        );

        testWithRecordings(
            "runApp launches the app in an online emulator only",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithFiveVSEmulators"],
            async () => {
                devices = fillDevices(["Nexus_5", "Nexus_6", "Nexus_7", "Nexus_8", "Nexus_9"]);
                devices[4].isOnline = false;

                await androidPlatform.runApp();
                const isRunningOnOfflineDevice =
                    devices[4].installedApplications[androidPackageName].isInDebugMode === false;
                isRunningOnOfflineDevice.should.be.false();
            },
        );

        testWithRecordings(
            "runApp launches the app in the device specified as target",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithFiveVSEmulators"],
            async () => {
                devices = fillDevices(["Nexus_5", "Nexus_6", "Nexus_10", "Nexus_11", "Nexus_12"]);

                const runOptions: any = {
                    platform: PlatformType.Android,
                    workspaceRoot: projectRoot,
                    projectRoot: projectRoot,
                    target: "Nexus_12",
                    reactNativeVersions: {
                        reactNativeVersion: "^0.19.0",
                        reactNativeWindowsVersion: "",
                    },
                    nodeModulesRoot,
                };
                const platform = createAndroidPlatform(runOptions);
                (platform as any).adbHelper = adbHelper;
                await platform.runApp();
                const isRunningOnNexus12 =
                    devices[4].installedApplications[androidPackageName].isInDebugMode === false;
                isRunningOnNexus12.should.be.true();
            },
        );

        testWithRecordings(
            "runApp launches the app in a random online device if the target is offline",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithTenVSEmulators"],
            async () => {
                const onlineDevicesIds = [
                    "Nexus_11",
                    "Nexus_13",
                    "Nexus_14",
                    "Nexus_15",
                    "Nexus_16",
                    "Nexus_17",
                ];
                const offineDevicesIds = ["Nexus_5", "Nexus_6", "Nexus_10", "Nexus_12"];
                devices = fillDevices(offineDevicesIds.concat(onlineDevicesIds));
                devices[0].isOnline = false;
                devices[1].isOnline = false;
                devices[2].isOnline = false;
                devices[3].isOnline = false;

                const runOptions: any = {
                    platform: PlatformType.Android,
                    workspaceRoot: projectRoot,
                    projectRoot: projectRoot,
                    target: "Nexus_12",
                    reactNativeVersions: {
                        reactNativeVersion: "^0.19.0",
                        reactNativeWindowsVersion: "",
                    },
                    nodeModulesRoot,
                };
                const platform = createAndroidPlatform(runOptions);
                (platform as any).adbHelper = adbHelper;
                await platform.runApp();
                const devicesRunningAppId = devices.filter(
                    (device: any) =>
                        device.installedApplications[androidPackageName].isInDebugMode === false,
                );
                devicesRunningAppId.length.should.eql(1);
                onlineDevicesIds.should.containEql(devicesRunningAppId[0].id);
            },
        );

        testWithRecordings(
            "runApp doesn't fail even if the call to start the LogCat does fail",
            [
                "react-native/run-android/win10-rn0.21.0/succeedsWithOneVSEmulator",
                "react-native/run-android/win10-rn0.22.2/succeedsWithOneVSEmulator",
                "react-native/run-android/osx10.10-rn0.21.0/succeedsWithOneVSEmulator",
            ],
            async () => {
                devices = fillDevices(["Nexus_5"]);

                await androidPlatform.runApp();
                const isRunning =
                    devices[0].installedApplications[androidPackageName].isInDebugMode === false;
                isRunning.should.be.true();
            },
        );

        testWithRecordings(
            "runApp fails when the android project doesn't exist, and shows a nice error message",
            [
                "react-native/run-android/win10-rn0.21.0/failsDueToAndroidFolderMissing",
                "react-native/run-android/win10-rn0.22.2/failsDueToAndroidFolderMissing",
            ],
            async () => {
                devices = fillDevices(["Nexus_5"]);

                await fileSystem.rmdir(androidProjectPath);
                let isRunning: boolean;
                try {
                    await androidPlatform.runApp();
                    should.assert(false, "Expected runApp to end up with an error");
                    isRunning = false;
                } catch (error) {
                    error.message.should.eql("Android project not found. (error code 1203)");
                    isRunning = !!devices[0].installedApplications[androidPackageName];
                }
                isRunning.should.be.false();
            },
        );

        testWithRecordings(
            "runApp fails when the android emulator shell is unresponsive, and shows a nice error message",
            ["react-native/run-android/osx10.10-rn0.21.0/failsDueToAdbCommandTimeout"],
            async () => {
                devices = fillDevices(["Nexus_5"]);

                let isRunning: boolean;
                try {
                    await androidPlatform.runApp();
                    should.assert(false, "Expected runApp to end up with an error");
                    isRunning = false;
                } catch (error) {
                    "An Android shell command timed-out. Please retry the operation. (error code 1202)".should.eql(
                        error.message,
                    );
                    isRunning = !!devices[0].installedApplications[androidPackageName];
                }
                isRunning.should.be.false();
            },
        );

        test("getRunArguments should return correct target", function () {
            const runOptions: any = {
                platform: PlatformType.Android,
                workspaceRoot: projectRoot,
                projectRoot: projectRoot,
                target: "Nexus_12",
                nodeModulesRoot,
            };
            const platform = createAndroidPlatform(runOptions);
            const runArgs = platform.getRunArguments();

            runArgs.should.be.an.Array();
            runArgs.should.containDeepOrdered(["--deviceId", "Nexus_12"]);
        });

        test("getRunArguments should remove simulator target from args", function () {
            const runOptions: any = {
                platform: PlatformType.Android,
                workspaceRoot: projectRoot,
                projectRoot: projectRoot,
                target: "simulator",
                nodeModulesRoot,
            };
            const platform = createAndroidPlatform(runOptions);
            const runArgs = platform.getRunArguments();

            runArgs.should.be.an.Array();
            runArgs.should.be.empty();
        });

        test("getRunArguments should remove device target from args", function () {
            const runOptions: any = {
                platform: PlatformType.Android,
                workspaceRoot: projectRoot,
                projectRoot: projectRoot,
                target: "device",
                nodeModulesRoot,
            };
            const platform = createAndroidPlatform(runOptions);
            const runArgs = platform.getRunArguments();

            runArgs.should.be.an.Array();
            runArgs.should.be.empty();
        });

        test("getRunArguments should return correct args", function () {
            const args = ["--deviceId", "device_id"];
            const runOptions: any = {
                platform: PlatformType.Android,
                workspaceRoot: projectRoot,
                projectRoot: projectRoot,
                runArguments: args,
                target: "Nexus_12",
                nodeModulesRoot,
            };
            const platform = createAndroidPlatform(runOptions);
            const runArgs = platform.getRunArguments();

            runArgs.should.be.an.Array();
            runArgs.should.containDeepOrdered(args);
        });

        test("AdbHelper should correctly parse Android Sdk Location from local.properties file content", () => {
            const adbHelper = new adb.AdbHelper("", nodeModulesRoot);
            let getPlatformStub: Sinon.SinonStub;
            function testPaths(inputPath: string, expectedPath: string) {
                const resultPath1 = adbHelper.parseSdkLocation(`sdk.dir=${inputPath}`);
                const resultPath2 = adbHelper.parseSdkLocation(`sdk.dir   =${inputPath}`);
                const resultPath3 = adbHelper.parseSdkLocation(`sdk.dir = ${inputPath}`);
                assert.strictEqual(resultPath1, expectedPath);
                assert.strictEqual(resultPath2, expectedPath);
                assert.strictEqual(resultPath3, expectedPath);
            }

            const os = require("os");
            function mockPlatform(platform: NodeJS.Platform) {
                getPlatformStub?.restore();
                getPlatformStub = sinon.stub(os, "platform", function () {
                    return platform;
                });
            }

            mockPlatform("win32");
            testPaths(
                String.raw`C\:\\Users\\User1\\AndroidSdk`,
                String.raw`C:\Users\User1\AndroidSdk`,
            );
            testPaths(String.raw`\\\\Network\\Shared\\Folder`, String.raw`\\Network\Shared\Folder`);
            testPaths(
                String.raw`\\\\Network\\Shared\\Folder\\Android SDK`,
                String.raw`\\Network\Shared\Folder\Android SDK`,
            );
            testPaths(
                String.raw`C\:\\Users\\User1\\Android Sdk`,
                String.raw`C:\Users\User1\Android Sdk`,
            );

            mockPlatform("darwin");
            testPaths(String.raw`/var/lib/some/path`, String.raw`/var/lib/some/path`);
            testPaths(String.raw`~/Library`, String.raw`~/Library`);
            testPaths(String.raw`/Users/User1/home/path`, String.raw`/Users/User1/home/path`);
            testPaths(
                String.raw`/Users/User1/home/path/Android SDK`,
                String.raw`/Users/User1/home/path/Android SDK`,
            );
            testPaths(
                String.raw`/Volumes/Macintosh HD/Users/foo/Library/Android/sdk/platform-tools`,
                String.raw`/Volumes/Macintosh HD/Users/foo/Library/Android/sdk/platform-tools`,
            );
        });

        test("AdbHelper getAdbPath function should correctly parse Android Sdk Location from local.properties and wrap with quotes", () => {
            function testPaths(expectedPath: string, projectRoot: string) {
                const adbHelper = new adb.AdbHelper(projectRoot, nodeModulesRoot);
                const resultPath = adbHelper.getAdbPath(projectRoot);
                assert.strictEqual(resultPath, expectedPath);
            }

            if (process.platform == "win32") {
                const mockProjectRoot = path.join(
                    __dirname,
                    "..",
                    "..",
                    "..",
                    "test",
                    "resources",
                    "auxiliaryFiles",
                    "templateProject",
                    "win",
                );
                testPaths(String.raw`"C:\Android\android sdk\platform-tools\adb"`, mockProjectRoot);
            } else {
                const mockProjectRoot = path.join(
                    __dirname,
                    "..",
                    "..",
                    "..",
                    "test",
                    "resources",
                    "auxiliaryFiles",
                    "templateProject",
                    "others",
                );
                testPaths(
                    String.raw`"/Volumes/Macintosh HD/Users/foo/Library/Android/sdk/platform-tools/adb"`,
                    mockProjectRoot,
                );
            }
        });
    });
});

function fillDevices(ids: string[]): any[] {
    let devices: any[] = [];
    ids.forEach(id => {
        devices.push({
            isOnline: true,
            installedApplications: {},
            runningApplications: {},
            isVirtualTarget: true,
            id: id,
        });
    });

    return devices;
}
