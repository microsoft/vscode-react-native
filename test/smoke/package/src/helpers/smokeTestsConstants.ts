// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as os from "os";
import { join } from "path";
const XDLFsCache = require("xdl/build/tools/FsCache");

export class SmokeTestsConstants {
    // Default code of android platform version which is being targeted during the tests.
    // 10 = Android Q
    public static defaultTargetAndroidPlatformVersion = "10";
    // Default code of iOS platform version which is being targeted during the tests.
    public static defaultTargetIosPlatformVersion = "14.2";
    // Default target emulator port
    public static defaultTargetAndroidPort = 5554;
    // Default target emulator name "emulator-" + port
    public static defaultTargetAndroidDeviceName = `emulator-${SmokeTestsConstants.defaultTargetAndroidPort}`;
    // Expo application cache for iOS platform
    public static iOSExpoAppsCacheDir = join(os.homedir(), ".expo", "ios-simulator-app-cache");
    // Expo versions cache
    public static ExpoVersionsJsonFilePath = join(XDLFsCache.getCacheDir(), "versions.json");
    // Timeout for driver to wait for UI elements response to interaction (in seconds)
    public static elementResponseTimeout = 250;
    // Timeout for enabling Remote JS Debugging while testing RN app
    public static enableRemoteJSTimeout = 120 * 1000;
    // Command for stop React Native Packager
    public static stopPackagerCommand = "Stop Packager";
    // Command for realod React Native application
    public static reloadAppCommand = "Reload App";

    // Timeout for macOS smoke test
    public static macOSTestTimeout = 500 * 1000;
    // Timeout for Windows smoke test
    public static windowsTestTimeout = 700 * 1000;
    // Timeout for Expo testing
    public static expoTestTimeout = 700 * 1000;
    // Timeout for iOS testing
    public static iosTestTimeout = 700 * 1000;
    // Timeout for Android testing
    public static androidTestTimeout = 400 * 1000;
    // Timeout for Android testing
    public static hermesTestTimeout = 15 * 60 * 1000;
    // Timeout for smoke tests setup
    public static smokeTestSetupAwaitTimeout = 30 * 60 * 1000;

    // Timeout for Expo app to execute
    public static expoAppBuildAndInstallTimeout = 60 * 1000;
    // Timeout for macOS app to build and to install
    public static macOSAppBuildAndInstallTimeout = 400 * 1000;
    // Timeout for Windows app to build and to install
    public static windowsAppBuildAndInstallTimeout = 600 * 1000;

    // Timeout for waitFor* commands
    public static waitForElementTimeout = 30 * 1000;
    // Timeout for Expo app to launch
    public static expoAppLaunchTimeout = 120 * 1000;
    // Timeout for Windows smoke test
    public static windowsTestTime = 800 * 1000;
    // Timeout before search string in debug console
    public static debugConsoleSearchTimeout = 0.5 * 1000;
    // Default React Native app name
    public static RNAppName = "latestRNApp";
    // Default React Native Hermes app name
    public static HermesAppName = "latestHermesRNApp";
    // Default Expo app name
    public static ExpoAppName = "latestExpoApp";
    // Default pure React Native for Expo test app name
    public static pureRNExpoAppName = "pureRNExpoApp";
    // Default React Native for Windows test app name
    public static RNWAppName = "RNWApp";
    // Default React Native macOS app name
    public static RNmacOSAppName = "latestRNmacOSApp";
    // Default React Native macOS Hermes app name
    public static RNmacOSHermesAppName = "latestRNmacOSHermesApp";

    // Default React Native app name
    public static sampleRNAppName = "ReactNativeSample";
    // Default React Native Hermes app name
    public static sampleHermesAppName = "HermesReactNativeSample";
    // Default Expo app name
    public static sampleExpoAppName = "ExpoSample";
    // Default pure React Native for Expo test app name
    public static samplePureRNExpoAppName = "PureRNExpoSample";
    // Default React Native for Windows test app name
    public static sampleRNWAppName = "RNWSample";
    // Default React Native macOS app name
    public static sampleRNmacOSAppName = "MacOSReactNativeSample";
    // Default React Native macOS Hermes app name
    public static sampleRNmacOSHermesAppName = "MacOSHermesReactNativeSample";

    // Name of artifacts (test logs) directory
    public static artifactsDir = "SmokeTestLogs";
    // Name of the VS Code user data directory
    public static VSCodeUserDataDir = "VSCodeUserData";
    // Name of application entry point .js file
    public static AppjsFileName = "App.js";
    // Name of application entry point .tsx file
    public static ApptsxFileName = "App.tsx";
    // Name of file where tests environment variables are stored
    public static EnvConfigFileName = "config.json";
    // Name of file where tests environment variables are stored for development environment
    public static EnvDevConfigFileName = "config.dev.json";
    // Log string in case of Metro Packager has started
    public static PackagerStartedPattern = "Packager started";
    // File name where logs from React Native output channel will be saved
    public static ReactNativeLogFileName = "ReactNative.txt";
    // File name where logs from React Native: Run exponent output channel will be saved
    public static ReactNativeRunExpoLogFileName = "ReactNativeRunexponent.txt";
    // File name where logs from Chrome Debug Core will be saved
    public static ChromeDebugCoreLogFileName = "ChromeDebugCoreLogs.txt";
    // File name where logs from VS Code driver will be saved
    public static VSCodeDriverLogFileName = "VSCodeDriverLogs.txt";
    // Expo client app Android package name
    public static expoPackageName = "host.exp.exponent";
}
