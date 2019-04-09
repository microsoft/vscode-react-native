// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export class SmokeTestsConstants {
// Default code of android platform version which is being targeted during the tests.
// 9 = Android Pie
public static defaultTargetAndroidPlatformVersion = "9";
// Default target emulator name "emulator-" + port
public static defaultTargetAndroidDeviceName = "emulator-5554";
// Timeout for smoke tests setup
public static smokeTestSetupAwaitTimeout = 15 * 60 * 1000;
// Timeout for emulator boot
public static emulatorLoadTimeout = 90 * 1000;
// Timeout for Spectron to wait for UI elements response to interaction (in seconds)
public static spectronElementResponseTimeout = 250;
// Timeout for enabling Remote JS Debugging while testing RN app
public static enableRemoteJSTimeout = 50 * 1000;
// Timeout for Android app to build and to install
public static androidAppBuildAndInstallTimeout = 300 * 1000;
// Timeout for Expo app to execute
public static expoAppBuildAndInstallTimeout = 60 * 1000;
}
