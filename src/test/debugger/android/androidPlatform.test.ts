// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as fs from "fs";
import * as path from "path";
import * as mockFs from "mock-fs";

import {AndroidPlatform} from "../../../common/android/androidPlatform";
import {IRunOptions} from "../../../common/launchArgs";
import {FileSystem} from "../../../common/node/fileSystem";
import {ReactNative022} from "../../resources/reactNative022";
import {AdbSimulator} from "../../resources/simulators/adbSimulator";
import {AVDManager} from "../../resources/simulators/avdManager";
import {FakeExtensionMessageSender} from "../../resources/fakeExtensionMessageSender";
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

        const rnProjectContent = fs.readFileSync(ReactNative022.DEFAULT_PROJECT_FILE, "utf8");

        let fileSystem: FileSystem;
        let adb: AdbSimulator;
        let simulatedAVDManager: AVDManager;
        let reactNative: ReactNative022;
        let fakeExtensionMessageSender: FakeExtensionMessageSender;
        let androidPlatform: AndroidPlatform;

        function createAndroidPlatform(runOptions: IRunOptions): AndroidPlatform {
            return new AndroidPlatform(runOptions, {
                adb: adb,
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
                    args: message.args && message.args.filter(value => value) || [],
                };
            });
            messagesWithoutUndefineds.should.eql([expectedMessage]);
        }

        function shouldHaveReceivedNoLogCatMessages(): void {
            fakeExtensionMessageSender.getAllMessagesSent().should.eql([]);
        }

        setup(() => {
            mockFs();

            // Configure all the dependencies we'll use in our tests
            fileSystem = new FileSystem();
            adb = new AdbSimulator(fileSystem);
            simulatedAVDManager = new AVDManager(adb);
            reactNative = new ReactNative022(adb, fileSystem);
            fakeExtensionMessageSender = new FakeExtensionMessageSender();
            androidPlatform = createAndroidPlatform(genericRunOptions);

            // Create a React-Native project we'll use in our tests
            return reactNative
                .fromProjectFileContent(rnProjectContent)
                .createProject(projectRoot, applicationName);
        });

        teardown(() => {
            mockFs.restore();
        });

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
                        return adb.isAppRunning(androidPackageName);
                    }).then(isRunning => {
                        isRunning.should.be.true();
                        shouldHaveReceivedSingleLogCatMessage("Nexus_5");
                    });
            });

        testWithRecordings("runApp launches the app when two emulators are connected",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithTwoVSEmulators"], () => {
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunchAll(["Nexus_5", "Nexus_6"]);
                    }).then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return Q.all([
                            adb.isAppRunning(androidPackageName, "Nexus_5"),
                            adb.isAppRunning(androidPackageName, "Nexus_6"),
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
                const devicesIds = ["Nexus_5", "Nexus_6", "Other_Nexus_6"];
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunchAll(devicesIds);
                    }).then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return Q.all([
                            adb.isAppRunning(androidPackageName, "Nexus_5"),
                            adb.isAppRunning(androidPackageName, "Nexus_6"),
                            adb.isAppRunning(androidPackageName, "Other_Nexus_6"),
                        ]);
                    }).then(isRunningList => {
                        // It should be running in exactly one of these three devices
                        isRunningList.filter(v => v).should.eql([true]);

                        // Get index of running emulator
                        const index = isRunningList.indexOf(true);
                        const emulatorWithAppRunningId = devicesIds[index];
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
                const onlineDevicesIds = ["Nexus_11"];
                const offineDevicesIds = ["Nexus_5", "Nexus_6", "Nexus_10", "Nexus_12"];
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunchAll(onlineDevicesIds.concat(offineDevicesIds));
                    }).then(() => {
                        return adb.notifyDevicesAreOffline(offineDevicesIds);
                    }).then(() => {
                        return androidPlatform.runApp();
                    }).then(() => {
                        return adb.isAppRunning(androidPackageName, "Nexus_11");
                    }).then((isRunningOnNexus11) => {
                        isRunningOnNexus11.should.be.true();
                        shouldHaveReceivedSingleLogCatMessage("Nexus_11");
                    });
            });

        testWithRecordings("runApp launches the app in the device specified as target",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithFiveVSEmulators"], () => {
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunchAll(["Nexus_5", "Nexus_6", "Nexus_10", "Nexus_11", "Nexus_12"]);
                    }).then(() => {
                        const runOptions: IRunOptions = { projectRoot: projectRoot, target: "Nexus_12" };
                        return createAndroidPlatform(runOptions).runApp();
                    }).then(() => {
                        return adb.isAppRunning(androidPackageName, "Nexus_12");
                    }).then((isRunningOnNexus12) => {
                        isRunningOnNexus12.should.be.true();
                        shouldHaveReceivedSingleLogCatMessage("Nexus_12");
                    });
            });

        testWithRecordings("runApp launches the app in a random online device if the target is offline",
            ["react-native/run-android/win10-rn0.21.0/succeedsWithTenVSEmulators"], () => {
                const onlineDevicesIds = ["Nexus_11", "Nexus_13", "Nexus_14", "Nexus_15", "Nexus_16", "Nexus_17"];
                const offineDevicesIds = ["Nexus_5", "Nexus_6", "Nexus_10", "Nexus_12"];
                return Q({})
                    .then(() => {
                        return simulatedAVDManager.createAndLaunchAll(onlineDevicesIds.concat(offineDevicesIds));
                    }).then(() => {
                        return adb.notifyDevicesAreOffline(offineDevicesIds);
                    }).then(() => {
                        const runOptions: IRunOptions = { projectRoot: projectRoot, target: "Nexus_12" };
                        return createAndroidPlatform(runOptions).runApp();
                    }).then(() => {
                        return adb.findDevicesRunningApp(androidPackageName);
                    }).then((devicesRunningAppId) => {
                        devicesRunningAppId.length.should.eql(1);
                        onlineDevicesIds.should.containEql(devicesRunningAppId[0]);
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
                        return adb.isAppRunning(androidPackageName);
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
                        return adb.isAppRunning(androidPackageName);
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
                        return adb.isAppRunning(androidPackageName);
                    }).then(isRunning => {
                        isRunning.should.be.false();
                        shouldHaveReceivedNoLogCatMessages();
                    });
            });
    });
});
