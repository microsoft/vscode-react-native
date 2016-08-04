// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as XDL from "../common/exponent/xdlInterface";
import {CommandExecutor} from "../common/commandExecutor";
import {SettingsHelper} from "./settingsHelper";
import {Log} from "../common/log/log";
import {Packager, PackagerRunAs} from "../common/packager";
import {AndroidPlatform} from "../common/android/androidPlatform";
import {PackagerStatus, PackagerStatusIndicator} from "./packagerStatusIndicator";
import {ReactNativeProjectHelper} from "../common/reactNativeProjectHelper";
import {TargetPlatformHelper} from "../common/targetPlatformHelper";
import {TelemetryHelper} from "../common/telemetryHelper";
import {IOSDebugModeManager} from "../common/ios/iOSDebugModeManager";
import {ExponentHelper} from "../common/exponent/exponentHelper";

export class CommandPaletteHandler {
    private reactNativePackager: Packager;
    private reactNativePackageStatusIndicator: PackagerStatusIndicator;
    private workspaceRoot: string;
    private exponentHelper: ExponentHelper;

    constructor(workspaceRoot: string, reactNativePackager: Packager, packagerStatusIndicator: PackagerStatusIndicator, exponentHelper: ExponentHelper) {
        this.workspaceRoot = workspaceRoot;
        this.reactNativePackager = reactNativePackager;
        this.reactNativePackageStatusIndicator = packagerStatusIndicator;
        this.exponentHelper = exponentHelper;
    }

    /**
     * Starts the React Native packager
     */
    public startPackager(): Q.Promise<void> {
        return this.exponentHelper.configureReactNativeEnvironment()
            .then(() =>
                this.executeCommandInContext("startPackager", () =>
                    this.runStartPackagerCommandAndUpdateStatus()));
    }

    /**
     * Starts the Exponent packager
     */
    public startExponentPackager(): Q.Promise<void> {
        return this.exponentHelper.configureExponentEnvironment()
            .then(() =>
                this.executeCommandInContext("startExponentPackager", () =>
                    this.runStartPackagerCommandAndUpdateStatus(PackagerRunAs.EXPONENT)));
    }

    /**
     * Kills the React Native packager invoked by the extension's packager
     */
    public stopPackager(): Q.Promise<void> {
        return this.executeCommandInContext("stopPackager", () => this.reactNativePackager.stop())
            .then(() => this.reactNativePackageStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPED));
    }

    /**
     * Execute command to publish to exponent host.
     */
    public publishToExpHost(): Q.Promise<void> {
        return this.executeCommandInContext("publishToExpHost", () => {
            this.executePublishToExpHost().then((didPublish) => {
                if (!didPublish) {
                    Log.logMessage("Publishing was unsuccessful. Please make sure you are logged in Exponent and your project is a valid Exponentjs project");
                }
            });
        });
    }

    /**
     * Executes the 'react-native run-android' command
     */
    public runAndroid(): Q.Promise<void> {
        TargetPlatformHelper.checkTargetPlatformSupport("android");
        return this.executeCommandInContext("runAndroid", () => this.executeWithPackagerRunning(() => {
            const packagerPort = SettingsHelper.getPackagerPort();
            return new AndroidPlatform({ projectRoot: this.workspaceRoot, packagerPort: packagerPort }).runApp(/*shouldLaunchInAllDevices*/true);
        }));
    }


    /**
     * Executes the 'react-native run-ios' command
     */
    public runIos(): Q.Promise<void> {
        TargetPlatformHelper.checkTargetPlatformSupport("ios");
        return this.executeCommandInContext("runIos", () => {
            // Set the Debugging setting to disabled, because in iOS it's persisted across runs of the app
            return new IOSDebugModeManager(this.workspaceRoot).setSimulatorJSDebuggingModeSetting(/*enable=*/ false)
                .catch(() => { }) // If setting the debugging mode fails, we ignore the error and we run the run ios command anyways
                .then(() => this.executeReactNativeRunCommand("run-ios"));
        });
    }

    /**
     * Helper method to run packager and update appropriate configurations
     */
    private runStartPackagerCommandAndUpdateStatus(startAs: PackagerRunAs = PackagerRunAs.REACT_NATIVE): Q.Promise<any> {
        if (startAs === PackagerRunAs.EXPONENT) {
            return this.loginToExponent()
                .then(() =>
                    this.reactNativePackager.startAsExponent(SettingsHelper.getPackagerPort())
                ).then(exponentUrl => {
                    this.reactNativePackageStatusIndicator.updatePackagerStatus(PackagerStatus.EXPONENT_PACKAGER_STARTED);
                    Log.logMessage("Application is running on Exponent.");
                    const exponentOutput = `Open your exponent app at ${exponentUrl}`;
                    Log.logMessage(exponentOutput);
                    vscode.window.showInformationMessage(exponentOutput);
                });
        }
        return this.reactNativePackager.startAsReactNative(SettingsHelper.getPackagerPort())
            .then(() => this.reactNativePackageStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED));
    }

    /**
     * Executes a react-native command passed after starting the packager
     * {command} The command to be executed
     * {args} The arguments to be passed to the command
     */
    private executeReactNativeRunCommand(command: string, args?: string[]): Q.Promise<void> {
        return this.executeWithPackagerRunning(() => {
            return new CommandExecutor(this.workspaceRoot).spawnReactCommand(command, args).outcome;
        });
    }

    /**
     * Executes a lambda function after starting the packager
     * {lambda} The lambda function to be executed
     */
    private executeWithPackagerRunning(lambda: () => Q.Promise<void>): Q.Promise<void> {
        // Start the packager before executing the React-Native command
        Log.logMessage("Attempting to start the React Native packager");
        return this.runStartPackagerCommandAndUpdateStatus().then(lambda);
    }

    /**
     * Ensures that we are in a React Native project and then executes the operation
     * Otherwise, displays an error message banner
     * {operation} - a function that performs the expected operation
     */
    private executeCommandInContext(rnCommand: string, operation: () => Q.Promise<void> | void): Q.Promise<void> {
        let reactNativeProjectHelper = new ReactNativeProjectHelper(vscode.workspace.rootPath);
        return TelemetryHelper.generate("RNCommand", (generator) => {
            generator.add("command", rnCommand, false);
            return reactNativeProjectHelper.isReactNativeProject().then(isRNProject => {
                generator.add("isRNProject", isRNProject, false);
                if (isRNProject) {
                    // Bring the log channel to focus
                    Log.setFocusOnLogChannel();

                    // Execute the operation
                    return operation();
                } else {
                    vscode.window.showErrorMessage("Current workspace is not a React Native project.");
                }
            });
        });
    }

    /**
     * Publish project to exponent server. In order to do this we need to make sure the user is logged in exponent and the packager is running.
     */
    private executePublishToExpHost(): Q.Promise<boolean> {
        Log.logMessage("Publishing app to Exponent server. This might take a moment.");
        return this.loginToExponent()
            .then(user => {
                Log.logMessage(`Publishing as ${user.username}...`);
                return this.startExponentPackager()
                    .then(() =>
                        XDL.publish(this.workspaceRoot))
                    .then(response => {
                        if (response.err || !response.url) {
                            return false;
                        }
                        const publishedOutput = `App successfully published to ${response.url}`;
                        Log.logMessage(publishedOutput);
                        vscode.window.showInformationMessage(publishedOutput);
                        return true;
                    });
            }).catch(() => {
                Log.logWarning("An error has occured. Please make sure you are logged in to exponent, your project is setup correctly for publishing and your packager is running as exponent.");
                return false;
            });
    }

    private loginToExponent(): Q.Promise<XDL.IUser> {
        return this.exponentHelper.loginToExponent(
            (message, password) => { return Q(vscode.window.showInputBox({ placeHolder: message, password: password })); },
            (message) => { return Q(vscode.window.showInformationMessage(message)); }
        );
    }
}
