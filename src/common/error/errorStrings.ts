// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as nls from "vscode-nls";
import {InternalErrorCode} from "./internalErrorCode";
const localize = nls.loadMessageBundle();

export const ERROR_STRINGS = {
    [InternalErrorCode.CommandFailed]: localize("CommandFailed", "Error while executing command '{0}'"),
    [InternalErrorCode.CommandFailedWithErrorCode]: localize("CommandFailedWithErrorCode", "Command '{0}' failed with error code {1}"),
    [InternalErrorCode.ExpectedIntegerValue]: localize("ExpectedIntegerValue", "Expected an integer. Couldn't read {0}"),
    [InternalErrorCode.PackagerStartFailed]: localize("PackagerStartFailed", "Error while executing React Native Packager."),
    [InternalErrorCode.IOSDeployNotFound]: localize("IOSDeployNotFound", "Unable to find ios-deploy. Please make sure to install it globally('npm install -g ios-deploy')"),
    [InternalErrorCode.DeviceNotPluggedIn]: localize("DeviceNotPluggedIn", "Unable to mount developer disk image."),
    [InternalErrorCode.DeveloperDiskImgNotMountable]: localize("DeveloperDiskImgNotMountable", "Unable to mount developer disk image."),
    [InternalErrorCode.UnableToLaunchApplication]: localize("UnableToLaunchApplication", "Unable to launch application."),
    [InternalErrorCode.ApplicationLaunchTimedOut]: localize("ApplicationLaunchTimedOut", "Timeout launching application. Is the device locked?"),
    [InternalErrorCode.IOSSimulatorNotLaunchable]: localize("IOSSimulatorNotLaunchable", "Unable to launch iOS simulator. Try specifying a different target."),
    [InternalErrorCode.OpnPackagerLocationNotFound]: localize("OpnPackagerLocationNotFound", "Opn package location not found"),
    [InternalErrorCode.OpnPackagerNotFound]: localize("OpnPackagerNotFound", "The package 'opn' was not found. {0}"),
    [InternalErrorCode.PackageNotFound]: localize("PackageNotFound", "Attempting to find package {0} failed with error: {1}"),
    [InternalErrorCode.PlatformNotSupported]: localize("PlatformNotSupported", "Platform '{0}' is not supported on host platform: {1}"),
    [InternalErrorCode.ProjectVersionNotParsable]: localize("ProjectVersionNotParsable", "Couldn't parse the version component of the package at {0}: version = {1}"),
    [InternalErrorCode.ProjectVersionUnsupported]: localize("ProjectVersionUnsupported", "Project version = {0}"),
    [InternalErrorCode.ProjectVersionNotReadable]: localize("ProjectVersionNotReadable", "Unable to read version = {0}"),
    [InternalErrorCode.TelemetryInitializationFailed]: localize("TelemetryInitializationFailed", "{0}. Couldn't initialize telemetry"),
    [InternalErrorCode.ExtensionActivationFailed]: localize("ExtensionActivationFailed", "Failed to activate the React Native Tools extension"),
    [InternalErrorCode.DebuggerStubLauncherFailed]: localize("DebuggerStubLauncherFailed", "Failed to setup the stub launcher for the debugger"),
    [InternalErrorCode.IntellisenseSetupFailed]: localize("IntellisenseSetupFailed", "Failed to setup IntelliSense"),
    [InternalErrorCode.NodeDebuggerConfigurationFailed]: localize("NodeDebuggerConfigurationFailed", "Failed to configure the node debugger location for the debugger"),
    [InternalErrorCode.FailedToStopPackagerOnExit]: localize("FailedToStopPackagerOnExit", "Failed to stop the packager while closing React Native Tools"),
    [InternalErrorCode.FailedToRunOnAndroid]: localize("FailedToRunOnAndroid", "Failed to run the application in Android"),
    [InternalErrorCode.FailedToRunOnIos]: localize("FailedToRunOnIos", "Failed to run the application in iOS"),
    [InternalErrorCode.FailedToRunExponent]: localize("FailedToRunExponent", "Failed to run the application in Exponent"),
    [InternalErrorCode.FailedToPublishToExpHost]: localize("FailedToRunExponent", "Failed to publish the application to Exponent"),
    [InternalErrorCode.FailedToStartPackager]: localize("FailedToStartPackager", "Failed to start the React Native packager"),
    [InternalErrorCode.FailedToStopPackager]: localize("FailedToStopPackager", "Failed to stop the React Native packager"),
    [InternalErrorCode.FailedToRestartPackager]: localize("FailedToRestartPackager", "Failed to restart the React Native packager"),
    [InternalErrorCode.DebuggingFailed]: localize("DebuggingFailed", "Cannot debug application"),
    [InternalErrorCode.DebuggingFailedInNodeWrapper]: localize("DebuggingFailedInNodeWrapper", "Cannot debug application due to an error in the internal Node Debugger"),
    [InternalErrorCode.RNTempFolderDeletionFailed]: localize("RNTempFolderDeletionFailed", "Couldn't delete the temporary folder {0}"),
    [InternalErrorCode.CouldNotFindLocationOfNodeDebugger]: localize("CouldNotFindLocationOfNodeDebugger", "Couldn't find the location of the node-debugger extension"),
    [InternalErrorCode.PackagerRunningInDifferentPort]: localize("PackagerRunningInDifferentPort", "A packager cannot be started on port {0} because a packager process is already running on port {1}"),
    [InternalErrorCode.ErrorWhileProcessingMessageInIPMSServer]: localize("ErrorWhileProcessingMessageInIPMSServer", "An error ocurred while handling message: {0}"),
    [InternalErrorCode.ErrorNoPipeFound]: localize("ErrorNoPipeFound", "Unable to set up communication with VSCode react-native extension. Is this a react-native project, and have you made sure that the react-native npm package is installed at the root?"),
    [InternalErrorCode.NotAllSuccessPatternsMatched]: localize("NotAllSuccessPatternsMatched", "Unknown error: not all success patterns were matched. \n It means that \"react-native run-{0}\" command failed. \n Please, check the View -> Toggle Output -> React Native, \n View -> Toggle Output -> React Native: Run {1} output windows."),
    [InternalErrorCode.CouldNotParsePackageVersion]: localize("CouldNotParsePackageVersion", "Couldn't parse the version component of the package at {0}: version = {1}"),
    [InternalErrorCode.UnsupportedCommandStatus]: localize("UnsupportedCommandStatus", "Unsupported command status"),

};
