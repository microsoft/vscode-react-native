// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";
import * as mockFs from "mock-fs";

import {AndroidPlatform} from "../../../debugger/android/androidPlatform";
import {IRunOptions} from "../../../common/launchArgs";
import {FileSystem} from "../../../common/node/fileSystem";
import {ReactNative022} from "../../../test/resources/reactNative022";
import {DeviceHelper} from "../../../test/resources/simulators/deviceHelper";
import {AVDManager} from "../../../test/resources/simulators/avdManager";
import {FakeExtensionMessageSender} from "../../../test/resources/fakeExtensionMessageSender";
import {ExtensionMessage} from "../../../common/extensionMessaging";
import {RecordingsHelper} from "../../resources/recordingsHelper";
import {RemoteExtension} from "../../../common/remoteExtension";

import "should";

// TODO: Launch the extension server

suite("androidPlatform", function () {
    suite("debuggerContext", function () {
        const projectRoot = "C:/projects/SampleApplication_21/";
        const androidProjectPath = path.join(projectRoot, "android");
        const applicationName = "SampleApplication";
        const androidPackageName = "com.sampleapplication";
        const genericRunOptions: IRunOptions = { projectRoot: projectRoot };

        let fileSystem: FileSystem;
        let deviceHelper: DeviceHelper;
        let simulatedAVDManager: AVDManager;
        let reactNative: ReactNative022;
        let fakeExtensionMessageSender: FakeExtensionMessageSender;
        let androidPlatform: AndroidPlatform;

        setup(() => {
            // Configure all the dependencies we'll use in our tests
            fileSystem = new FileSystem({ fs: mockFs.fs({}) });
            deviceHelper = new DeviceHelper(fileSystem);
            simulatedAVDManager = new AVDManager(deviceHelper);
            reactNative = new ReactNative022(deviceHelper, fileSystem);
            fakeExtensionMessageSender = new FakeExtensionMessageSender();
            androidPlatform = new AndroidPlatform(genericRunOptions, {
                deviceHelper: deviceHelper,
                reactNative: reactNative,
                fileSystem: fileSystem,
                remoteExtension: new RemoteExtension(fakeExtensionMessageSender),
            });

            // Create a React-Native project we'll use in our tests
            return reactNative.createProject(projectRoot, applicationName);
        });

        function createAndroidPlatform(runOptions: IRunOptions): AndroidPlatform {
            return new AndroidPlatform(runOptions, {
                deviceHelper: deviceHelper,
                reactNative: reactNative,
                fileSystem: fileSystem,
                remoteExtension: new RemoteExtension(fakeExtensionMessageSender),
            });
        }

        function shouldHaveReceivedSingleLogCatMessage(deviceId: string): void {
            const expectedMessage = { message: ExtensionMessage.START_MONITORING_LOGCAT, args: [deviceId] };

            const messagesSent = fakeExtensionMessageSender.getAllMessagesSent();
            const messagesWithoutUndefineds = messagesSent.map(message => {
                return {
                    message: message.message,
                    args: message.args.filter(value => value),
                };
            });
            messagesWithoutUndefineds.should.eql([expectedMessage]);
        }

        function shouldHaveReceivedNoLogCatMessages(): void {
            fakeExtensionMessageSender.getAllMessagesSent().should.eql([]);
        }

        const testWithRecordings = new RecordingsHelper(() => reactNative).test;

        testWithRecordings("runApp launches the app when a single emulator is connected",
            [
                "react-native/run-android/win10-rn0.21.0/succeedsWithOneVSEmulator",
                "react-native/run-android/win10-rn0.22.2/succeedsWithOneVSEmulator",
                "react-native/run-android/osx10.10-rn0.21.0/succeedsWithOneVSEmulator",
            ], () => {
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunch("Nexus_5");
                    }).then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return deviceHelper.isAppRunning(androidPackageName);
                    }).then(isRunning => {
                        isRunning.should.be.true();
                        shouldHaveReceivedSingleLogCatMessage("Nexus_5");
                    });
            });

        testWithRecordings("runApp launches the app when two emulators are connected",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithTwoVSEmulators"], () => {
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunchAll("Nexus_5", "Nexus_6");
                    }).then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return Q.all([
                            deviceHelper.isAppRunning(androidPackageName, "Nexus_5"),
                            deviceHelper.isAppRunning(androidPackageName, "Nexus_6"),
                        ]);
                    }).spread((isRunningOnNexus5, isRunningOnNexus6) => {
                        // It should be running in exactly one of these two devices
                        isRunningOnNexus5.should.not.eql(isRunningOnNexus6);
                        const emulatorWithAppRunningId = isRunningOnNexus5 ? "Nexus_5" : "Nexus_6";
                        shouldHaveReceivedSingleLogCatMessage(emulatorWithAppRunningId);
                    });
            });

        testWithRecordings("runApp launches the app when three emulators are connected",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithThreeVSEmulators"], () => {
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunchAll("Nexus_5", "Nexus_6", "Other_Nexus_6");
                    }).then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return Q.all([
                            deviceHelper.isAppRunning(androidPackageName, "Nexus_5"),
                            deviceHelper.isAppRunning(androidPackageName, "Nexus_6"),
                            deviceHelper.isAppRunning(androidPackageName, "Other_Nexus_6"),
                        ]);
                    }).then(isRunningList => {
                        // It should be running in exactly one of these two devices
                        isRunningList.filter(v => v).should.eql([true]);

                        // Get index of running emulator
                        const index = isRunningList.indexOf(true);
                        const emulatorWithAppRunningId = ["Nexus_5", "Nexus_6", "Other_Nexus_6"][index];
                        shouldHaveReceivedSingleLogCatMessage(emulatorWithAppRunningId);
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
                        reason.message.should.eql("Unknown error");
                        shouldHaveReceivedNoLogCatMessages();
                    });
            });

        testWithRecordings("runApp launches the app in an online emulator only",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithFiveVSEmulators"], () => {
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunchAll("Nexus_5", "Nexus_6", "Nexus_10", "Nexus_11", "Nexus_12");
                    }).then(() => {
                        return deviceHelper.notifyDevicesAreOffline("Nexus_5", "Nexus_6", "Nexus_10", "Nexus_12");
                    }).then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return deviceHelper.isAppRunning(androidPackageName, "Nexus_11");
                    }).then((isRunningOnNexus11) => {
                        isRunningOnNexus11.should.be.true();
                        shouldHaveReceivedSingleLogCatMessage("Nexus_11");
                    });
            });

        testWithRecordings("runApp launches the app in the device specified as target",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithFiveVSEmulators"], () => {
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunchAll("Nexus_5", "Nexus_6", "Nexus_10", "Nexus_11", "Nexus_12");
                    }).then(() => {
                        const runOptions: IRunOptions = { projectRoot: projectRoot, target: "Nexus_12" };
                        return createAndroidPlatform(runOptions).runApp();
                    }).then(() => {
                        return deviceHelper.isAppRunning(androidPackageName, "Nexus_12");
                    }).then((isRunningOnNexus12) => {
                        isRunningOnNexus12.should.be.true();
                        shouldHaveReceivedSingleLogCatMessage("Nexus_12");
                    });
            });

        testWithRecordings("runApp launches the app in a random online device if the target is offline",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithTenVSEmulators"], () => {
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunchAll("Nexus_5", "Nexus_6", "Nexus_10", "Nexus_11", "Nexus_12",
                            "Nexus_13", "Nexus_14", "Nexus_15", "Nexus_16", "Nexus_17");
                    }).then(() => {
                        return deviceHelper.notifyDevicesAreOffline("Nexus_5", "Nexus_6", "Nexus_10", "Nexus_12");
                    }).then(() => {
                        const runOptions: IRunOptions = { projectRoot: projectRoot, target: "Nexus_12" };
                        return createAndroidPlatform(runOptions).runApp();
                    }).then(() => {
                        return deviceHelper.findDevicesRunningApp(androidPackageName);
                    }).then((devicesRunningAppId) => {
                        const onlineDevices = ["Nexus_11", "Nexus_13", "Nexus_14", "Nexus_15", "Nexus_16", "Nexus_17"];

                        devicesRunningAppId.length.should.eql(1);
                        onlineDevices.should.containEql(devicesRunningAppId[0]);
                        shouldHaveReceivedSingleLogCatMessage(devicesRunningAppId[0]);
                    });
            });

        testWithRecordings("runApp doesn't fail even if the call to start the LogCat does fail",
            [
                "react-native/run-android/win10-rn0.21.0/succeedsWithOneVSEmulator",
                "react-native/run-android/win10-rn0.22.2/succeedsWithOneVSEmulator",
                "react-native/run-android/osx10.10-rn0.21.0/succeedsWithOneVSEmulator",
            ], () => {
                fakeExtensionMessageSender.setMessageResponse(Q.reject<void>("Unknown error"));

                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunch("Nexus_5");
                    }).then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return deviceHelper.isAppRunning(androidPackageName);
                    }).then(isRunning => {
                        isRunning.should.be.true();
                        shouldHaveReceivedSingleLogCatMessage("Nexus_5");
                    });
            });

        testWithRecordings("runApp fails when the android project doesn't exist, and shows a nice error message",
            [
                "react-native/run-android/win10-rn0.21.0/failsDueToAndroidFolderMissing",
                "react-native/run-android/win10-rn0.22.2/failsDueToAndroidFolderMissing",
            ], () => {
                return Q({})
                    .then(() => {
                        return fileSystem.rmdir(androidProjectPath);
                    }).then(() => {
                        return simulatedAVDManager.createAndLaunch("Nexus_5");
                    }).then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        should.assert(false, "Expected runApp to end up with an error");
                        return false;
                    }, reason => {
                        reason.message.should.eql("Android project not found.");
                        return deviceHelper.isAppRunning(androidPackageName);
                    }).then(isRunning => {
                        isRunning.should.be.false();
                        shouldHaveReceivedNoLogCatMessages();
                    });
            });

        testWithRecordings("runApp fails when the android emulator shell is unresponsive, and shows a nice error message",
            ["react-native/run-android/osx10.10-rn0.21.0/failsDueToAdbCommandTimeout"], () => {
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunch("Nexus_5");
                    }).then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        should.assert(false, "Expected runApp to end up with an error");
                        return false;
                    }, reason => {
                        "An Android shell command timed-out. Please retry the operation.".should.eql(reason.message);
                        return deviceHelper.isAppRunning(androidPackageName);
                    }).then(isRunning => {
                        isRunning.should.be.false();
                        shouldHaveReceivedNoLogCatMessages();
                    });
            });
    });
});
