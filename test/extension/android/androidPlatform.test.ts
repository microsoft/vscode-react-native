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
import { AppLauncher } from "../../../src/extension/appLauncher";

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

        const nodeModulesRoot: string = AppLauncher.getNodeModulesRoot(projectRoot);
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
        let sandbox: Sinon.SinonSandbox;
        let devices: any;
        let adbHelper: adb.AdbHelper;

        function createAndroidPlatform(runOptions: IAndroidRunOptions): AndroidPlatform {
            return new AndroidPlatform(runOptions);
        }

        setup(() => {
            sandbox = sinon.sandbox.create();

            // Configure all the dependencies we'll use in our tests
            fileSystem = new FileSystem();

            adbHelper = new adb.AdbHelper(genericRunOptions.projectRoot, nodeModulesRoot);
            sandbox.stub(
                adbHelper,
                "launchApp",
                (projectRoot_: string, packageName: string, debugTarget?: string) => {
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

                    return Promise.resolve();
                },
            );
            sandbox.stub(adbHelper, "getConnectedDevices", function () {
                return Promise.resolve(devices);
            });
            sandbox.stub(adbHelper, "getOnlineDevices", function () {
                return Promise.resolve(
                    devices.filter((device: any) => {
                        return device.isOnline;
                    }),
                );
            });
            sandbox.stub(adbHelper, "apiVersion", function () {
                return Promise.resolve(adb.AndroidAPILevel.LOLLIPOP);
            });
            sandbox.stub(adbHelper, "reverseAdb", function () {
                return Promise.resolve();
            });

            reactNative = new ReactNative022(fileSystem, adbHelper);

            sandbox.stub(SettingsHelper, "getReactNativeProjectRoot", () => projectRoot);

            androidPlatform = createAndroidPlatform(genericRunOptions);

            sandbox.stub(CommandExecutor.prototype, "spawnReactCommand", function () {
                return reactNative.runAndroid(genericRunOptions);
            });

            sandbox.stub(ProjectVersionHelper, "getReactNativeVersions", function () {
                return Promise.resolve({
                    reactNativeVersion: "0.0.1",
                    reactNativeWindowsVersion: "",
                });
            });

            androidPlatform.setAdbHelper(adbHelper);

            sandbox.stub(reactNative, "installAppInDevice", function (deviceId: string) {
                devices = devices.map((device: any) => {
                    if (deviceId && deviceId === device.id) {
                        device.installedApplications[androidPackageName] = {};
                    }

                    return device;
                });
                return Promise.resolve();
            });

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
            sandbox.restore();
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
            () => {
                devices = fillDevices(["Nexus_5"]);

                return androidPlatform
                    .runApp()
                    .then(() => {
                        return (
                            devices[0].installedApplications[androidPackageName].isInDebugMode ===
                            false
                        );
                    })
                    .then(isRunning => {
                        isRunning.should.be.true();
                    });
            },
        );

        testWithRecordings(
            "runApp launches the app when two emulators are connected",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithTwoVSEmulators"],
            () => {
                devices = fillDevices(["Nexus_5", "Nexus_6"]);

                return androidPlatform
                    .runApp()
                    .then(() => {
                        return Promise.all([
                            Promise.resolve(
                                devices[0].installedApplications[androidPackageName]
                                    .isInDebugMode === false,
                            ),
                            Promise.resolve(
                                devices[1].installedApplications[androidPackageName]
                                    .isInDebugMode === false,
                            ),
                        ]);
                    })
                    .then(([isRunningOnNexus5, isRunningOnNexus6]) => {
                        // It should be running in exactly one of these two devices
                        isRunningOnNexus5.should.not.eql(isRunningOnNexus6);
                    });
            },
        );

        testWithRecordings(
            "runApp launches the app when three emulators are connected",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithThreeVSEmulators"],
            () => {
                devices = fillDevices(["Nexus_5", "Nexus_6", "Nexus_7"]);

                return androidPlatform
                    .runApp()
                    .then(() => {
                        return Promise.all([
                            Promise.resolve(
                                devices[0].installedApplications[androidPackageName]
                                    .isInDebugMode === false,
                            ),
                            Promise.resolve(
                                devices[1].installedApplications[androidPackageName]
                                    .isInDebugMode === false,
                            ),
                            Promise.resolve(
                                devices[2].installedApplications[androidPackageName]
                                    .isInDebugMode === false,
                            ),
                        ]);
                    })
                    .then(isRunningList => {
                        // It should be running in exactly one of these three devices
                        isRunningList.filter(v => v).should.eql([true]);
                    });
            },
        );

        testWithRecordings(
            "runApp fails if no devices are connected",
            ["react-native/run-android/win10-rn0.21.0/failsDueToNoDevicesConnected"],
            () => {
                return androidPlatform.runApp().then(
                    () => {
                        should.assert(false, "runApp should've exited with an error");
                    },
                    reason => {
                        reason.message
                            .startsWith("Unknown error: not all success patterns were matched")
                            .should.be.true();
                    },
                );
            },
        );

        testWithRecordings(
            "runApp launches the app in an online emulator only",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithFiveVSEmulators"],
            () => {
                devices = fillDevices(["Nexus_5", "Nexus_6", "Nexus_7", "Nexus_8", "Nexus_9"]);
                devices[4].isOnline = false;

                return androidPlatform
                    .runApp()
                    .then(() => {
                        return (
                            devices[4].installedApplications[androidPackageName].isInDebugMode ===
                            false
                        );
                    })
                    .then(isRunningOnOfflineDevice => {
                        isRunningOnOfflineDevice.should.be.false();
                    });
            },
        );

        testWithRecordings(
            "runApp launches the app in the device specified as target",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithFiveVSEmulators"],
            () => {
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
                platform.setAdbHelper(adbHelper);
                return platform
                    .runApp()
                    .then(() => {
                        return (
                            devices[4].installedApplications[androidPackageName].isInDebugMode ===
                            false
                        );
                    })
                    .then(isRunningOnNexus12 => {
                        isRunningOnNexus12.should.be.true();
                    });
            },
        );

        testWithRecordings(
            "runApp launches the app in a random online device if the target is offline",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithTenVSEmulators"],
            () => {
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
                platform.setAdbHelper(adbHelper);
                return platform
                    .runApp()
                    .then(() => {
                        return devices.filter(
                            (device: any) =>
                                device.installedApplications[androidPackageName].isInDebugMode ===
                                false,
                        );
                    })
                    .then(devicesRunningAppId => {
                        devicesRunningAppId.length.should.eql(1);
                        onlineDevicesIds.should.containEql(devicesRunningAppId[0].id);
                    });
            },
        );

        testWithRecordings(
            "runApp doesn't fail even if the call to start the LogCat does fail",
            [
                "react-native/run-android/win10-rn0.21.0/succeedsWithOneVSEmulator",
                "react-native/run-android/win10-rn0.22.2/succeedsWithOneVSEmulator",
                "react-native/run-android/osx10.10-rn0.21.0/succeedsWithOneVSEmulator",
            ],
            () => {
                devices = fillDevices(["Nexus_5"]);

                return androidPlatform
                    .runApp()
                    .then(() => {
                        return (
                            devices[0].installedApplications[androidPackageName].isInDebugMode ===
                            false
                        );
                    })
                    .then(isRunning => {
                        isRunning.should.be.true();
                    });
            },
        );

        testWithRecordings(
            "runApp fails when the android project doesn't exist, and shows a nice error message",
            [
                "react-native/run-android/win10-rn0.21.0/failsDueToAndroidFolderMissing",
                "react-native/run-android/win10-rn0.22.2/failsDueToAndroidFolderMissing",
            ],
            () => {
                devices = fillDevices(["Nexus_5"]);

                return fileSystem
                    .rmdir(androidProjectPath)
                    .then(() => {
                        return androidPlatform.runApp();
                    })
                    .then(
                        () => {
                            should.assert(false, "Expected runApp to end up with an error");
                            return false;
                        },
                        reason => {
                            reason.message.should.eql(
                                "Android project not found. (error code 1203)",
                            );
                            return !!devices[0].installedApplications[androidPackageName];
                        },
                    )
                    .then(isRunning => {
                        isRunning.should.be.false();
                    });
            },
        );

        testWithRecordings(
            "runApp fails when the android emulator shell is unresponsive, and shows a nice error message",
            ["react-native/run-android/osx10.10-rn0.21.0/failsDueToAdbCommandTimeout"],
            () => {
                devices = fillDevices(["Nexus_5"]);

                return androidPlatform
                    .runApp()
                    .then(
                        () => {
                            should.assert(false, "Expected runApp to end up with an error");
                            return false;
                        },
                        reason => {
                            "An Android shell command timed-out. Please retry the operation. (error code 1202)".should.eql(
                                reason.message,
                            );
                            return !!devices[0].installedApplications[androidPackageName];
                        },
                    )
                    .then(isRunning => {
                        isRunning.should.be.false();
                    });
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
            function testPaths(inputPath: string, expectedPath: string) {
                const resultPath = adbHelper.parseSdkLocation(`sdk.dir=${inputPath}`);
                assert.strictEqual(resultPath, expectedPath);
            }

            const os = require("os");
            function mockPlatform(platform: NodeJS.Platform) {
                sandbox.restore();
                sandbox.stub(os, "platform", function () {
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
            type: adb.DeviceType.AndroidSdkEmulator,
            id: id,
        });
    });

    return devices;
}
