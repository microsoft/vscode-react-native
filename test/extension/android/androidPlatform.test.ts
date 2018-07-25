// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as fs from "fs";
import * as path from "path";
import * as mockFs from "mock-fs";

import {AndroidPlatform} from "../../../src/extension/android/androidPlatform";
import {IAndroidRunOptions} from "../../../src/extension/launchArgs";
import {FileSystem} from "../../../src/common/node/fileSystem";
import {ReactNative022} from "../../resources/reactNative022";
import * as adb from "../../../src/extension/android/adb";
import {RecordingsHelper} from "../../resources/recordingsHelper";
import {CommandExecutor} from "../../../src/common/commandExecutor";
import * as rnHelper from "../../../src/common/reactNativeProjectHelper";

import "should";
import * as sinon from "sinon";
import { SettingsHelper } from "../../../src/extension/settingsHelper";

// TODO: Launch the extension server

suite("androidPlatform", function () {
    suite("extensionContext", function () {
        const projectRoot = "C:/projects/SampleApplication_21/";
        const androidProjectPath = path.join(projectRoot, "android");
        const applicationName = "SampleApplication";
        const androidPackageName = "com.sampleapplication";
        const genericRunOptions: IAndroidRunOptions = { platform: "android", workspaceRoot: projectRoot, projectRoot: projectRoot };

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
            mockFs();
            sandbox = sinon.sandbox.create();

            // Configure all the dependencies we'll use in our tests
            fileSystem = new FileSystem();

            adbHelper = new adb.AdbHelper(genericRunOptions.projectRoot);
            sandbox.stub(adbHelper, "launchApp", function (projectRoot_: string, packageName: string, debugTarget?: string) {
                devices = devices.map((device: any) => {
                    if (!debugTarget) {
                        device.installedApplications[androidPackageName] = { isInDebugMode: false };
                    }

                    if (debugTarget && debugTarget === device.id) {
                        device.installedApplications[androidPackageName] = { isInDebugMode: false };
                    }

                    return device;
                });

                return Q.resolve(void 0);
            });
            sandbox.stub(adbHelper, "getConnectedDevices", function () {
                return Q.resolve(devices);
            });
            sandbox.stub(adbHelper, "getOnlineDevices", function () {
                return Q.resolve(devices.filter((device: any) => {
                    return device.isOnline;
                }));
            });
            sandbox.stub(adbHelper, "apiVersion", function () {
                return Q.resolve(adb.AndroidAPILevel.LOLLIPOP);
            });
            sandbox.stub(adbHelper, "reverseAdb", function () {
                return Q.resolve(void 0);
            });

            reactNative = new ReactNative022(fileSystem, adbHelper);

            sandbox.stub(SettingsHelper, "getReactNativeProjectRoot", () => projectRoot);

            androidPlatform = createAndroidPlatform(genericRunOptions);

            sandbox.stub(CommandExecutor.prototype, "spawnReactCommand", function () {
                return reactNative.runAndroid(genericRunOptions);
            });

            sandbox.stub(rnHelper.ReactNativeProjectHelper, "getReactNativeVersion", function () {
                return Q.resolve("0.0.1");
            });

            androidPlatform.setAdbHelper(adbHelper);

            sandbox.stub(reactNative, "installAppInDevice", function (deviceId: string) {
                devices = devices.map((device: any)  => {
                    if (deviceId && deviceId === device.id) {
                        device.installedApplications[androidPackageName] = {};
                    }

                    return device;
                });
                return Q.resolve(void 0);
            });

            // Create a React-Native project we'll use in our tests
            return reactNative
                .fromProjectFileContent(rnProjectContent)
                .createProject(projectRoot, applicationName);
        });

        teardown(() => {
            mockFs.restore();
            sandbox.restore();
            devices = [];
        });

        const testWithRecordings = new RecordingsHelper(() => reactNative).test;

        testWithRecordings("runApp launches the app when a single emulator is connected",
            [
                "react-native/run-android/win10-rn0.21.0/succeedsWithOneVSEmulator",
                "react-native/run-android/win10-rn0.22.2/succeedsWithOneVSEmulator",
                "react-native/run-android/osx10.10-rn0.21.0/succeedsWithOneVSEmulator",
            ], () => {
                devices = fillDevices(["Nexus_5"]);

                return Q({})
                    .then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return devices[0].installedApplications[androidPackageName].isInDebugMode === false;
                    }).then(isRunning => {
                        isRunning.should.be.true();
                    });
            });

        testWithRecordings("runApp launches the app when two emulators are connected",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithTwoVSEmulators"], () => {
                devices = fillDevices(["Nexus_5", "Nexus_6"]);

                return Q({})
                    .then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return Q.all([
                            Q.resolve(devices[0].installedApplications[androidPackageName].isInDebugMode === false),
                            Q.resolve(devices[1].installedApplications[androidPackageName].isInDebugMode === false),
                        ]);
                    }).spread((isRunningOnNexus5, isRunningOnNexus6) => {
                        // It should be running in exactly one of these two devices
                        isRunningOnNexus5.should.not.eql(isRunningOnNexus6);
                    });
            });

        testWithRecordings("runApp launches the app when three emulators are connected",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithThreeVSEmulators"], () => {
                devices = fillDevices(["Nexus_5", "Nexus_6", "Nexus_7"]);
                return Q({})
                    .then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return Q.all([
                            Q.resolve(devices[0].installedApplications[androidPackageName].isInDebugMode === false),
                            Q.resolve(devices[1].installedApplications[androidPackageName].isInDebugMode === false),
                            Q.resolve(devices[2].installedApplications[androidPackageName].isInDebugMode === false),
                        ]);
                    }).then(isRunningList => {
                        // It should be running in exactly one of these three devices
                        isRunningList.filter(v => v).should.eql([true]);
                    });
            });

        testWithRecordings("runApp fails if no devices are connected",
            ["react-native/run-android/win10-rn0.21.0/failsDueToNoDevicesConnected"], () => {
                return Q({})
                    .then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        should.assert(false, "runApp should've exited with an error");
                    }, reason => {
                        reason.message.startsWith("Unknown error: not all success patterns were matched").should.be.true();
                    });
            });

        testWithRecordings("runApp launches the app in an online emulator only",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithFiveVSEmulators"], () => {
                devices = fillDevices(["Nexus_5", "Nexus_6", "Nexus_7", "Nexus_8", "Nexus_9"]);
                devices[4].isOnline = false;

                return Q({})
                    .then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return devices[4].installedApplications[androidPackageName].isInDebugMode === false;
                    }).then((isRunningOnOfflineDevice) => {
                        isRunningOnOfflineDevice.should.be.false();
                    });
            });

        testWithRecordings("runApp launches the app in the device specified as target",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithFiveVSEmulators"], () => {
                devices = fillDevices(["Nexus_5", "Nexus_6", "Nexus_10", "Nexus_11", "Nexus_12"]);

                return Q({})
                    .then(() => {
                        const runOptions: any = { platform: "android", workspaceRoot: projectRoot, projectRoot: projectRoot, target: "Nexus_12" };
                        const platform = createAndroidPlatform(runOptions);
                        platform.setAdbHelper(adbHelper);
                        return platform.runApp();
                    }).then(() => {
                        return devices[4].installedApplications[androidPackageName].isInDebugMode === false;
                    }).then((isRunningOnNexus12) => {
                        isRunningOnNexus12.should.be.true();
                    });
            });

        testWithRecordings("runApp launches the app in a random online device if the target is offline",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithTenVSEmulators"], () => {
                const onlineDevicesIds = ["Nexus_11", "Nexus_13", "Nexus_14", "Nexus_15", "Nexus_16", "Nexus_17"];
                const offineDevicesIds = ["Nexus_5", "Nexus_6", "Nexus_10", "Nexus_12"];
                devices = fillDevices(offineDevicesIds.concat(onlineDevicesIds));
                devices[0].isOnline = false;
                devices[1].isOnline = false;
                devices[2].isOnline = false;
                devices[3].isOnline = false;

                return Q({})
                    .then(() => {
                        const runOptions: any = { platform: "android", workspaceRoot: projectRoot, projectRoot: projectRoot, target: "Nexus_12" };
                        const platform = createAndroidPlatform(runOptions);
                        platform.setAdbHelper(adbHelper);
                        return platform.runApp();
                    }).then(() => {
                        return devices.filter((device: any) => device.installedApplications[androidPackageName].isInDebugMode === false);
                    }).then((devicesRunningAppId) => {
                        devicesRunningAppId.length.should.eql(1);
                        onlineDevicesIds.should.containEql(devicesRunningAppId[0].id);
                    });
            });

        testWithRecordings("runApp doesn't fail even if the call to start the LogCat does fail",
            [
                "react-native/run-android/win10-rn0.21.0/succeedsWithOneVSEmulator",
                "react-native/run-android/win10-rn0.22.2/succeedsWithOneVSEmulator",
                "react-native/run-android/osx10.10-rn0.21.0/succeedsWithOneVSEmulator",
            ], () => {
                devices = fillDevices(["Nexus_5"]);

                return Q({})
                    .then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return devices[0].installedApplications[androidPackageName].isInDebugMode === false;
                    }).then(isRunning => {
                        isRunning.should.be.true();
                    });
            });

        testWithRecordings("runApp fails when the android project doesn't exist, and shows a nice error message",
            [
                "react-native/run-android/win10-rn0.21.0/failsDueToAndroidFolderMissing",
                "react-native/run-android/win10-rn0.22.2/failsDueToAndroidFolderMissing",
            ], () => {
                devices = fillDevices(["Nexus_5"]);

                return Q({})
                    .then(() => {
                        return fileSystem.rmdir(androidProjectPath);
                    }).then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        should.assert(false, "Expected runApp to end up with an error");
                        return false;
                    }, reason => {
                        reason.message.should.eql("Android project not found.");
                        return !!devices[0].installedApplications[androidPackageName];
                    }).then(isRunning => {
                        isRunning.should.be.false();
                    });
            });

        testWithRecordings("runApp fails when the android emulator shell is unresponsive, and shows a nice error message",
            ["react-native/run-android/osx10.10-rn0.21.0/failsDueToAdbCommandTimeout"], () => {
                devices = fillDevices(["Nexus_5"]);

                return Q({})
                    .then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        should.assert(false, "Expected runApp to end up with an error");
                        return false;
                    }, reason => {
                        "An Android shell command timed-out. Please retry the operation.".should.eql(reason.message);
                        return !!devices[0].installedApplications[androidPackageName];
                    }).then(isRunning => {
                        isRunning.should.be.false();
                    });
            });
    });
});

function fillDevices(ids: string[]): any[] {
    let devices: any[] = [];
    ids.forEach(id => {
        devices.push({ isOnline: true, installedApplications: {}, runningApplications: {}, type: adb.DeviceType.AndroidSdkEmulator, id: id });
    });

    return devices;
}