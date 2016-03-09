// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import {CommandExecutor} from "../common/commandExecutor";
import {DeviceHelper, IDevice} from "../common/android/deviceHelper";
import {Log} from "../common/log/log";
import {Packager} from "../common/packager";
import {Package} from "../common/node/package";
import {PackageNameResolver} from "../common/android/packageNameResolver";
import {ReactNativeProjectHelper} from "../common/reactNativeProjectHelper";
import {TelemetryHelper} from "../common/telemetryHelper";
import {IOSDebugModeManager} from "../common/ios/iOSDebugModeManager";

export class CommandPaletteHandler {
    private reactNativePackager: Packager;
    private workspaceRoot: string;

    constructor(workspaceRoot: string, reactNativePackager: Packager) {
        this.workspaceRoot = workspaceRoot;
        this.reactNativePackager = reactNativePackager;
    }

    /**
     * Starts the React Native packager
     */
    public startPackager(): Q.Promise<void> {
        return this.executeCommandInContext("startPackager", () => this.reactNativePackager.start());
    }

    /**
     * Kills the React Native packager invoked by the extension's packager
     */
    public stopPackager(): Q.Promise<void> {
        return this.executeCommandInContext("stopPackager", () => this.reactNativePackager.stop());
    }

    /**
     * Executes the 'react-native run-android' command
     */
    public runAndroid(): Q.Promise<void> {
        /* If there are multiple devices available, the run-android command will install the application on each and then print a warning.
           The command will succeed but the application will not be launched on any device.
           We fix this behavior by checking if there are more than one devices available and running the application on each.  */
        return this.executeCommandInContext("runAndroid", () => this.executeReactNativeRunCommand("run-android"))
            .then(() => {
                let deviceHelper = new DeviceHelper();
                let pkg = new Package(this.workspaceRoot);

                return Q.all<any>([
                    pkg.name().then((appName) => new PackageNameResolver(appName).resolvePackageName(this.workspaceRoot)),
                    deviceHelper.getConnectedDevices()
                ]).spread<any>((packagName: string, devices: IDevice[]) => {
                    if (devices.length > 1) {
                        let result = Q<void>(void 0);
                        /* if we have more than one device, launch the application on each */
                        devices.forEach((device: IDevice) => {
                            if (device.isOnline) {
                                result = result.then(() => deviceHelper.launchApp(this.workspaceRoot, packagName, device.id));
                            }
                        });
                        return result;
                    } else {
                        return Q.resolve(void 0);
                    }
                });
            });
    }

    /**
     * Executes the 'react-native run-ios' command
     */
    public runIos(): Q.Promise<void> {
        return this.executeCommandInContext("runIos", () => {
            // Set the Debugging setting to disabled, because in iOS it's persisted across runs of the app
            return new IOSDebugModeManager(this.workspaceRoot).setSimulatorJSDebuggingModeSetting(/*enable=*/ false)
                .catch(() => { }) // If setting the debugging mode fails, we ignore the error and we run the run ios command anyways
                .then(() => this.executeReactNativeRunCommand("run-ios"));
        });
    }

    /**
     * Executes a react-native command passed after starting the packager
     * {command} The command to be executed
     * {args} The arguments to be passed to the command
     */
    private executeReactNativeRunCommand(command: string, args?: string[]): Q.Promise<void> {
        // Start the packager before executing the React-Native command
        Log.logMessage("Attempting to start the React Native packager");

        return this.reactNativePackager.start()
            .then(() => {
                return new CommandExecutor(this.workspaceRoot).spawnReactCommand(command, args, null);
            }).then(() => {
                return Q.resolve<void>(void 0);
            });
    }

    /**
     * Ensures that we are in a React Native project and then executes the operation
     * Otherwise, displays an error message banner
     * {operation} - a function that performs the expected operation
     */
    private executeCommandInContext(rnCommand: string, operation: () => void): Q.Promise<void> {
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
}
