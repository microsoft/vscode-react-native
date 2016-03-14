// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as mockFs from "mock-fs";

import {AndroidPlatform} from "../../../debugger/android/androidPlatform";
import {FileSystem} from "../../../common/node/fileSystem";
import {ReactNative022} from "../../../test/resources/reactNative022";
import {SimulatedDeviceHelper} from "../../../test/resources/simulatedDeviceHelper";
import {SimulatedAVDManager} from "../../../test/resources/simulatedAVDManager";
import {FakeExtensionMessageSender} from "../../../test/resources/fakeExtensionMessageSender";
import {IEventArguments} from "../../../test/resources/processExecutionEvents";

import {Nothing} from "../../friendlyShould";
Nothing.supressTSLintWarning();

/* We test runAndroid022 by comparing the events it generates against the ones we recorded from the real process, so we know that
    our simulation matches the real library. */
// TODO: Add more tests/traces
suite("runAndroid022", () => {
    suite("debuggerContext", () => {
        const projectRoot = "C:/projects/myAwesomeRNApp/";
        const applicationName = "SampleApplication";

        let fileSystem: FileSystem;
        let deviceHelper: SimulatedDeviceHelper;
        let simulatedAVDManager: SimulatedAVDManager;
        let reactNative: ReactNative022;
        let fakeExtensionMessageSender: FakeExtensionMessageSender;
        let androidPlatform: AndroidPlatform;

        setup(() => {
            // Configure all the dependencies we'll use in our tests
            fileSystem = new FileSystem({fs: mockFs.fs({})});
            deviceHelper = new SimulatedDeviceHelper(fileSystem);
            simulatedAVDManager = new SimulatedAVDManager(deviceHelper);
            reactNative = new ReactNative022(deviceHelper, fileSystem);
            fakeExtensionMessageSender = new FakeExtensionMessageSender();
            androidPlatform = new AndroidPlatform({ deviceHelper: deviceHelper, reactNative: reactNative,
                fileSystem: fileSystem, extensionMessageSender: fakeExtensionMessageSender });

            // Create a React-Native project we'll use in our tests
            return reactNative.createProject(projectRoot, applicationName);
        });

        function normalizeEvents(events: IEventArguments[]): any {
            return events.map(event => {
                const normalizedEvent = Object.assign({}, event);
                delete normalizedEvent.after;
                return normalizedEvent;
            });
        }

        test("runAndroid generates the correct events when packager is already running and build is succesful", () => {
            const expectedEvents = [
                {"after": 3532, "stderr": {"data": "'which' is not recognized as an internal or external command,\r\noperable program or batch file.\r\n"}},
                {"after": 765, "stdout": {"data": "JS server already running.\n"}},
                {"after": 0, "stdout": {"data": "Building and installing the app on the device (cd android && gradlew.bat installDebug)...\n"}},
                {"after": 4170, "stdout": {"data": ":app:preBuild"}},
                {"after": 21, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 18, "stdout": {"data": ":app:preDebugBuild"}},
                {"after": 0, "stdout": {"data": " UP-TO-DATE\r\n"}},
                {"after": 1, "stdout": {"data": ":app:checkDebugManifest"}},
                {"after": 2, "stdout": {"data": "\r\n"}},
                {"after": 1, "stdout": {"data": ":app:preReleaseBuild"}},
                {"after": 0, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 1, "stdout": {"data": ":app:prepareComAndroidSupportAppcompatV72301Library"}},
                {"after": 105, "stdout": {"data": " UP-TO-DATE"}},
                {"after": 0, "stdout": {"data": "\r\n"}},
                {"after": 0, "stdout": {"data": ":app:prepareComAndroidSupportRecyclerviewV72301Library"}},
                {"after": 4, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 1, "stdout": {"data": ":app:prepareComAndroidSupportSupportV42301Library"}},
                {"after": 5, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 2, "stdout": {"data": ":app:prepareComFacebookFrescoDrawee081Library"}},
                {"after": 2, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:prepareComFacebookFrescoFbcore081Library"}},
                {"after": 4, "stdout": {"data": " UP-TO-DATE"}},
                {"after": 0, "stdout": {"data": "\r\n"}},
                {"after": 0, "stdout": {"data": ":app:prepareComFacebookFrescoFresco081Library"}},
                {"after": 4, "stdout": {"data": " UP-TO-DATE"}},
                {"after": 0, "stdout": {"data": "\r\n"}},
                {"after": 0, "stdout": {"data": ":app:prepareComFacebookFrescoImagepipeline081Library"}},
                {"after": 8, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 1, "stdout": {"data": ":app:prepareComFacebookFrescoImagepipelineOkhttp081Library"}},
                {"after": 3, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:prepareComFacebookReactReactNative0220Library"}},
                {"after": 13, "stdout": {"data": " UP-TO-DATE"}},
                {"after": 0, "stdout": {"data": "\r\n"}},
                {"after": 1, "stdout": {"data": ":app:prepareOrgWebkitAndroidJscR174650Library"}},
                {"after": 3, "stdout": {"data": " UP-TO-DATE"}},
                {"after": 0, "stdout": {"data": "\r\n"}},
                {"after": 1, "stdout": {"data": ":app:prepareDebugDependencies"}},
                {"after": 3, "stdout": {"data": "\r\n"}},
                {"after": 0, "stdout": {"data": ":app:compileDebugAidl"}},
                {"after": 13, "stdout": {"data": " UP-TO-DATE\r\n"}},
                {"after": 1, "stdout": {"data": ":app:compileDebugRenderscript"}},
                {"after": 15, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 1, "stdout": {"data": ":app:generateDebugBuildConfig"}},
                {"after": 40, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 1, "stdout": {"data": ":app:generateDebugAssets"}},
                {"after": 0, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:mergeDebugAssets"}},
                {"after": 15, "stdout": {"data": " UP-TO-DATE"}},
                {"after": 0, "stdout": {"data": "\r\n"}},
                {"after": 0, "stdout": {"data": ":app:generateDebugResValues"}},
                {"after": 3, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 1, "stdout": {"data": ":app:generateDebugResources"}},
                {"after": 0, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:mergeDebugResources"}},
                {"after": 145, "stdout": {"data": " UP-TO-DATE"}},
                {"after": 1, "stdout": {"data": "\r\n"}},
                {"after": 0, "stdout": {"data": ":app:bundleDebugJsAndAssets"}},
                {"after": 0, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "SKIPPED\r\n"}},
                {"after": 0, "stdout": {"data": ":app:processDebugManifest"}},
                {"after": 30, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:processDebugResources"}},
                {"after": 80, "stdout": {"data": " "}},
                {"after": 1, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 1, "stdout": {"data": ":app:generateDebugSources"}},
                {"after": 0, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE"}},
                {"after": 0, "stdout": {"data": "\r\n"}},
                {"after": 1, "stdout": {"data": ":app:processDebugJavaRes"}},
                {"after": 1, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:compileDebugJavaWithJavac"}},
                {"after": 39, "stdout": {"data": " UP-TO-DATE"}},
                {"after": 0, "stdout": {"data": "\r\n"}},
                {"after": 0, "stdout": {"data": ":app:compileDebugNdk"}},
                {"after": 1, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:compileDebugSources"}},
                {"after": 1, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 1, "stdout": {"data": ":app:preDexDebug"}},
                {"after": 14, "stdout": {"data": " "}},
                {"after": 1, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:dexDebug"}},
                {"after": 27, "stdout": {"data": " "}},
                {"after": 1, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:validateDebugSigning"}},
                {"after": 2, "stdout": {"data": "\r\n"}},
                {"after": 0, "stdout": {"data": ":app:packageDebug"}},
                {"after": 30, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:zipalignDebug"}},
                {"after": 4, "stdout": {"data": " "}},
                {"after": 0, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:assembleDebug"}},
                {"after": 0, "stdout": {"data": " "}},
                {"after": 1, "stdout": {"data": "UP-TO-DATE\r\n"}},
                {"after": 0, "stdout": {"data": ":app:installDebug"}},
                {"after": 1510, "stdout": {"data": "\r\n"}},
                {"after": 0, "stdout": {"data": "Installing APK 'app-debug.apk' on '5\" Marshmallow (6.0.0) XHDPI Phone - 6.0'\r\n"}},
                {"after": 2752, "stdout": {"data": "Installed on 1 device.\r\n"}},
                {"after": 0, "stdout": {"data": "\r\n"}},
                {"after": 0, "stdout": {"data": "BUILD SUCCESSFUL\r\n"}},
                {"after": 0, "stdout": {"data": "\r\nTotal time: 9.023 secs\r\n"}},
                {"after": 536, "stderr": {"data": "Picked up _JAVA_OPTIONS: -Xmx512M\n"}},
                {"after": 50, "stdout": {"data": "Starting the app (C:\\Users\\johnny\\AppData\\Local\\Android\\sdk/platform-tools/adb shell am start -n com.sampleapplication/.MainActivity)...\n"}},
                {"after": 155, "stdout": {"data": "Starting: Intent { cmp=com.sampleapplication/.MainActivity }\r\r\n"}},
                {"after": 1043, "exit": {"code": 0}}];

            return Q({})
                .then(() => {
                    return simulatedAVDManager.createAndLaunch("Nexus_5");
                }).then(() => {
                    return reactNative.runAndroid(projectRoot).outcome;
                }).then(isRunning => {
                    const generated = normalizeEvents(reactNative.getSimulatedEvents());
                    const expected = normalizeEvents(expectedEvents);
                    generated.should.be.eql(expected);
                });
        });
    });
});