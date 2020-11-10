// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export class SmokeTestsConstants {
    // Default code of android platform version which is being targeted during the tests.
    // 9 = Android Pie
    public static defaultTargetAndroidPlatformVersion = "9";
    // Default code of iOS platform version which is being targeted during the tests.
    public static defaultTargetIosPlatformVersion = "12.4";
    // Default target emulator name "emulator-" + port
    public static defaultTargetAndroidDeviceName = "emulator-5554";
    // Timeout for smoke tests setup
    public static smokeTestSetupAwaitTimeout = 30 * 60 * 1000;
    // Timeout for emulator boot
    public static emulatorLoadTimeout = 90 * 1000;
    // Timeout for driver to wait for UI elements response to interaction (in seconds)
    public static elementResponseTimeout = 250;
    // Timeout for enabling Remote JS Debugging while testing RN app
    public static enableRemoteJSTimeout = 120 * 1000;
    // Timeout for waitFor* commands
    public static waitForTimeout = 30 * 1000;
    // Timeout for Android app to build and to install
    public static androidAppBuildAndInstallTimeout = 300 * 1000;
    // Timeout for iOS app to build and to install
    public static iosAppBuildAndInstallTimeout = 600 * 1000;
    // Timeout for Expo app to execute
    public static expoAppBuildAndInstallTimeout = 60 * 1000;
    // Timeout for Expo app to launch
    public static expoAppLaunchTimeout = 120 * 1000;
    // Timeout for Windows app to build and to install
    public static windowsAppBuildAndInstallTimeout = 400 * 1000;
    // Timeout for Windows smoke test
    public static windowsTestTime = 700 * 1000;
    // Timeout before search string in debug console
    public static debugConsoleSearchTimeout = 0.5 * 1000;
    // Default React Native app name
    public static RNAppName = "latestRNApp";
    // Default Expo app name
    public static ExpoAppName = "latestExpoApp";
    // Default pure React Native for Expo test app name
    public static pureRNExpoApp = "pureRNExpoApp";
    // Default React Native for Windows test app name
    public static RNWAppName = "RNWApp";
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
    // Log string in case of Expo launched successfully
    public static ExpoSuccessPattern = "Tunnel ready";
    // Log string in case of Expo launch failed
    public static ExpoFailurePattern = "XDLError";
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
    // String for simulator target in launch configuration
    public static SimulatorString = "simulator";
}
