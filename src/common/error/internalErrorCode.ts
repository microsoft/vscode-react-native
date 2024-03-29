// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export enum InternalErrorCode {
    // Command Executor errors
    CommandFailed = 101,
    CommandFailedWithErrorCode = 102,
    PackagerStartFailed = 103,
    FailedToRunOnAndroid = 104,
    FailedToRunOnIos = 105,
    FailedToStartPackager = 106,
    FailedToStopPackager = 107,
    PackagerRunningInDifferentPort = 108,
    FailedToRestartPackager = 109,
    FailedToRunExponent = 110,
    FailedToPublishToExpHost = 111,
    UnsupportedCommandStatus = 112,
    CommandFailedWithDetails = 113,
    FailedToRunOnWindows = 114,
    FailedToRunOnMacOS = 115,
    DebuggingCommandFailed = 116,
    FailedToTestDevEnvironment = 117,
    CommandCanceled = 118,
    FailedToConfigEASBuild = 119,
    FailedToOpenProjectPage = 120,
    FailedToRevertOpenModule = 121,
    FailedToOpenRNUpgradeHelper = 122,
    FailedToInstallExpoGo = 123,
    FailedToLaunchExpoWeb = 124,
    FailedToRunRNDoctor = 125,
    FailedToRunExpoDoctor = 126,
    FailedToRunPrebuildClean = 128,
    // Device Deployer errors
    IOSDeployNotFound = 201,

    // Device Runner errors
    DeviceNotPluggedIn = 301,
    DeveloperDiskImgNotMountable = 302,
    ApplicationLaunchFailed = 303,
    ApplicationLaunchTimedOut = 304,
    FailedToStartAndroidEmulator = 305,
    TargetSelectionError = 306,
    FailedToStartIOSSimulator = 307,
    CouldNotRecognizeTargetType = 308,

    // iOS Platform errors
    IOSSimulatorNotLaunchable = 401,
    IOSFoundMoreThanOneExecutablesCleanupBuildFolder = 402,
    IOSCouldNotFoundExecutableInFolder = 403,
    IOSCouldNotFoundDeviceForDirectDebugging = 404,
    IOSThereIsNoAnyDebuggableTarget = 405,

    // Packager errors
    OpnPackagerLocationNotFound = 501,
    OpnPackagerNotFound = 502,
    FailedToStopPackagerOnExit = 503,
    CannotAttachToPackagerCheckPackagerRunningOnPort = 504,
    AnotherDebuggerConnectedToPackager = 505,

    // React Native Project errors
    ProjectVersionNotParsable = 601,
    ProjectVersionUnsupported = 602,
    ProjectVersionNotReadable = 603,
    NotInReactNativeFolderError = 604,
    CouldNotFindProjectVersion = 605,
    ReactNativePackageIsNotInstalled = 606,
    ReactNativeWindowsIsNotInstalled = 607,
    ReactNativemacOSIsNotInstalled = 608,

    // Miscellaneous errors
    TelemetryInitializationFailed = 701,
    ExtensionActivationFailed = 702,
    DebuggerStubLauncherFailed = 703,
    IntellisenseSetupFailed = 704,
    NodeDebuggerConfigurationFailed = 705,
    DebuggingFailed = 706,
    RNTempFolderDeletionFailed = 707,
    DebuggingFailedInNodeWrapper = 708,
    PlatformNotSupported = 709,
    WorkspaceNotFound = 710,
    ExpectedExponentTunnelPath = 711,
    NotAllSuccessPatternsMatched = 712,
    CouldNotParsePackageVersion = 713,
    PackageNotFound = 714,
    ReactDevtoolsIsNotInstalled = 715,
    CancellationTokenTriggered = 716,
    UnknownError = 717,
    WorkspaceIsNotTrusted = 718,
    UserInputCanceled = 719,

    // Activation errors
    CouldNotFindLocationOfNodeDebugger = 801,
    CouldNotFindWorkspace = 802,

    // Inter Process Communication errors
    ErrorWhileProcessingMessageInIPMSServer = 901,
    ErrorNoPipeFound = 902,

    // Validating user input errors
    ExpectedIntegerValue = 1001,
    ExpectedStringValue = 1002,
    ExpectedBooleanValue = 1003,
    ExpectedArrayValue = 1004,
    ExpectedObjectValue = 1005,

    // Exponent errors
    RNVersionNotSupportedByExponent = 1101,
    UserCancelledExpoLogin = 1102,
    NgrokIsNotInstalledGlobally = 1103,

    // Android errors
    AndroidCouldNotInstallTheAppOnAnyAvailibleDevice = 1201,
    AndroidShellCommandTimedOut = 1202,
    AndroidProjectNotFound = 1203,
    AndroidMoreThanOneDeviceOrEmulator = 1204,
    AndroidFailedToLaunchTheSpecifiedActivity = 1205,
    AndroidCouldNotStartLogCatMonitor = 1206,
    AndroidCouldNotStopLogCatMonitor = 1207,
    AndroidCouldNotFindActiveLogCatMonitor = 1208,
    AndroidThereIsNoAnyOnlineDebuggableTarget = 1209,

    // Windows Phone errors
    WinRNMPPluginIsNotInstalled = 1301,
    WinRunCommandFailed = 1302,

    // Debugger errors
    SourcesStoragePathIsNullOrEmpty = 1401,
    DebuggingWontWorkReloadJSAndReconnect = 1402,
    ReconnectionToPackagerFailedCheckForErrorsOrRestartReactNative = 1403,
    FailedToProcessMessageFromReactNativeApp = 1404,
    FailedToPrepareJSRuntimeEnvironment = 1405,
    FailedToSendMessageToTheReactNativeApp = 1406,
    ReactNativeWorkerProcessThrownAnError = 1407,
    CouldntImportScriptAt = 1408,
    RNMessageWithMethodExecuteApplicationScriptDoesntHaveURLProperty = 1409,
    CouldNotAttachToDebugger = 1410,
    CouldNotDirectDebugWithoutHermesEngine = 1411,

    // CDP Proxy errors
    CouldNotConnectToDebugTarget = 1501,

    // Network Inspector errors
    CouldNotStartNetworkInspector = 1601,
    CouldNotStopNetworkInspector = 1602,
}
