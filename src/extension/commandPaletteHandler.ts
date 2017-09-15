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
        return this.executeCommandInContext("startPackager", () =>
            this.reactNativePackager.isRunning()
            .then((running) => {
                return running ? this.reactNativePackager.stop() : Q.resolve(void 0);
            })
        )
        .then(() => this.runStartPackagerCommandAndUpdateStatus());
    }

    /**
     * Starts the Exponent packager
     */
    public startExponentPackager(): Q.Promise<void> {
        return this.executeCommandInContext("startExponentPackager", () =>
            this.reactNativePackager.isRunning()
            .then((running) => {
                return running ? this.reactNativePackager.stop() : Q.resolve(void 0);
            })
        ).then(() =>
            this.exponentHelper.configureExponentEnvironment()
        ).then(() => this.runStartPackagerCommandAndUpdateStatus(PackagerRunAs.EXPONENT));
    }

    /**
     * Kills the React Native packager invoked by the extension's packager
     */
    public stopPackager(): Q.Promise<void> {
        return this.executeCommandInContext("stopPackager", () => this.reactNativePackager.stop())
            .then(() => this.reactNativePackageStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPED));
    }

    /**
     * Restarts the React Native packager
     */
    public restartPackager(): Q.Promise<void> {
        return this.executeCommandInContext("restartPackager", () =>
            this.runRestartPackagerCommandAndUpdateStatus());
    }

    /**
     * Execute command to publish to exponent host.
     */
    public publishToExpHost(): Q.Promise<void> {
        return this.executeCommandInContext("publishToExpHost", () => {
            return this.executePublishToExpHost().then((didPublish) => {
                if (!didPublish) {
                    Log.logMessage("Publishing was unsuccessful. Please make sure you are logged in Exponent and your project is a valid Exponentjs project");
                }
            });
        });
    }

    /**
     * Executes the 'react-native run-android' command
     */
    public runAndroid(target: "device" | "simulator" = "simulator"): Q.Promise<void> {
        TargetPlatformHelper.checkTargetPlatformSupport("android");
        return this.executeCommandInContext("runAndroid", () => this.executeWithPackagerRunning(() => {
            const packagerPort = SettingsHelper.getPackagerPort();
            const runArgs = SettingsHelper.getRunArgs("android", target);
            const platform = new AndroidPlatform({ platform: "android", projectRoot: this.workspaceRoot, packagerPort: packagerPort, runArguments: runArgs });
            return  platform.runApp(/*shouldLaunchInAllDevices*/true)
                .then(() => {
                    return platform.disableJSDebuggingMode();
                });
        }));
    }

    /**
     * Executes the 'react-native run-ios' command
     */
    public runIos(target: "device" | "simulator" = "simulator"): Q.Promise<void> {
        TargetPlatformHelper.checkTargetPlatformSupport("ios");
        return this.executeCommandInContext("runIos", () => {
            const runArgs = SettingsHelper.getRunArgs("ios", target);
            runArgs.push("-no-packager");
            // Set the Debugging setting to disabled, because in iOS it's persisted across runs of the app
            return new IOSDebugModeManager(this.workspaceRoot)
                .setSimulatorRemoteDebuggingSetting(/*enable=*/ false)
                .catch(() => { }) // If setting the debugging mode fails, we ignore the error and we run the run ios command anyways
                .then(() => this.executeReactNativeRunCommand("run-ios", runArgs));
        });
    }

    private runRestartPackagerCommandAndUpdateStatus(): Q.Promise<void> {
        return this.reactNativePackager.restart(SettingsHelper.getPackagerPort())
            .then(() => this.reactNativePackageStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED));
    }

    /**
     * Helper method to run packager and update appropriate configurations
     */
    private runStartPackagerCommandAndUpdateStatus(startAs: PackagerRunAs = PackagerRunAs.REACT_NATIVE): Q.Promise<any> {
        if (startAs === PackagerRunAs.EXPONENT) {
            return this.loginToExponent()
                .then(() =>
                    this.reactNativePackager.startAsExponent()
                ).then(exponentUrl => {
                    this.reactNativePackageStatusIndicator.updatePackagerStatus(PackagerStatus.EXPONENT_PACKAGER_STARTED);
                    Log.logMessage("Application is running on Exponent.");
                    const exponentOutput = `Open your exponent app at ${exponentUrl}`;
                    Log.logMessage(exponentOutput);
                    vscode.commands.executeCommand("vscode.previewHtml", vscode.Uri.parse(exponentUrl), 1, "Expo QR code");
                });
        }
        return this.reactNativePackager.startAsReactNative()
            .then(() => this.reactNativePackageStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED));
    }

    /**
     * Executes a react-native command passed after starting the packager
     * {command} The command to be executed
     * {args} The arguments to be passed to the command
     */
    private executeReactNativeRunCommand(command: string, args: string[] = []): Q.Promise<void> {
        return this.executeWithPackagerRunning(() => {
            return new CommandExecutor(this.workspaceRoot)
                .spawnReactCommand(command, args).outcome;
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
    private executeCommandInContext(rnCommand: string, operation: () => Q.Promise<void>): Q.Promise<void> {
        let reactNativeProjectHelper = new ReactNativeProjectHelper(this.workspaceRoot);
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
                    return;
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
            (message, password) => {
                return Q.Promise((resolve, reject) => {
                    vscode.window.showInputBox({ placeHolder: message, password: password })
                    .then(resolve, reject);
                });
            },
            (message) => {
                return Q.Promise((resolve, reject) => {
                    vscode.window.showInformationMessage(message)
                        .then(resolve, reject);
                });
            }
        );
    }
}
