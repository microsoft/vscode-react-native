// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export enum InternalErrorCode {
        // Command Executor errors
        CommandExecutionFailed = 101,
        PackagerStartFailed = 102,
        FailedToRunOnAndroid = 103,
        FailedToRunOnIos = 104,
        FailedToStartPackager = 105,
        FailedToStopPackager = 106,

        // Device Deployer errors
        IDeviceInstallerNotFound = 201,

        // Device Runner errors
        DeviceNotPluggedIn = 301,
        DeveloperDiskImgNotMountable = 302,
        UnableToLaunchApplication = 303,
        ApplicationLaunchTimedOut = 304,

        // iOS Platform errors
        IOSSimulatorNotLaunchable = 401,

        // Packager errors
        OpnPackagerLocationNotFound = 501,
        OpnPackagerNotFound = 502,
        FailedToStopPackagerOnExit = 503,

        // React Native Project errors
        ProjectVersionNotParsable = 601,
        ProjectVersionUnsupported = 602,
        ProjectVersionNotReadable = 603,

        // Miscellaneous errors
        TelemetryInitializationFailed = 701,
        ExtensionActivationFailed = 702,
        DebuggerStubLauncherFailed = 703,
        IntellisenseSetupFailed = 704,
        NodeDebuggerConfigurationFailed = 705,
        DebuggingFailed = 706,
        RNTempFolderDeletionFailed = 707
    }
