// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as XDL from "./exponent/xdlInterface";
import {SettingsHelper} from "./settingsHelper";
import {OutputChannelLogger} from "./log/OutputChannelLogger";
import {Packager, PackagerRunAs} from "../common/packager";
import {AndroidPlatform} from "./android/androidPlatform";
import {IOSPlatform} from "./ios/iOSPlatform";
import {PackagerStatus} from "./packagerStatusIndicator";
import {ReactNativeProjectHelper} from "../common/reactNativeProjectHelper";
import {TargetPlatformHelper} from "../common/targetPlatformHelper";
import {TelemetryHelper} from "../common/telemetryHelper";
import {ExponentHelper} from "./exponent/exponentHelper";

interface IReactNativeProject {
    reactNativePackager: Packager;
    exponentHelper: ExponentHelper;
    workspaceFolder: vscode.WorkspaceFolder;
}

export class CommandPaletteHandler {
    private static projectsCache: any = {};
    private static logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();

    public static addProject(reactNativePackager: Packager, exponentHelper: ExponentHelper, workspaceFolder: vscode.WorkspaceFolder): void {
        this.projectsCache[workspaceFolder.name] = {
            reactNativePackager: Packager,
            exponentHelper: ExponentHelper,
            workspaceFolder,
        };
    }

    public static getProject(workspaceFolder: vscode.WorkspaceFolder): any {
        return this.projectsCache[workspaceFolder.name];
    }

    public static delProject(workspaceFolder: vscode.WorkspaceFolder): void {
        delete this.projectsCache[workspaceFolder.name];
    }

    /**
     * Starts the React Native packager
     */
    public static startPackager(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.executeCommandInContext("startPackager", project.workspaceFolder, () =>
                    project.reactNativePackager.isRunning()
                        .then((running) => {
                            return running ? project.reactNativePackager.stop() : Q.resolve(void 0);
                        })
                )
                    .then(() => this.runStartPackagerCommandAndUpdateStatus(project));
            });
    }

    /**
     * Starts the Exponent packager
     */
    public static startExponentPackager(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.executeCommandInContext("startExponentPackager", project.workspaceFolder, () =>
                    project.reactNativePackager.isRunning()
                        .then((running) => {
                            return running ? project.reactNativePackager.stop() : Q.resolve(void 0);
                        })
                ).then(() =>
                    project.exponentHelper.configureExponentEnvironment()
                    ).then(() => this.runStartPackagerCommandAndUpdateStatus(project, PackagerRunAs.EXPONENT));
            });
    }

    /**
     * Kills the React Native packager invoked by the extension's packager
     */
    public static stopPackager(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.executeCommandInContext("stopPackager", project.workspaceFolder, () => project.reactNativePackager.stop())
                    .then(() => project.reactNativePackager.statusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPED));
            });
    }

    /**
     * Restarts the React Native packager
     */
    public static restartPackager(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.executeCommandInContext("restartPackager", project.workspaceFolder, () =>
                    this.runRestartPackagerCommandAndUpdateStatus(project));
            });
    }

    /**
     * Execute command to publish to exponent host.
     */
    public static publishToExpHost(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.executeCommandInContext("publishToExpHost", project.workspaceFolder, () => {
                    return this.executePublishToExpHost(project).then((didPublish) => {
                        if (!didPublish) {
                            CommandPaletteHandler.logger.warning("Publishing was unsuccessful. Please make sure you are logged in Exponent and your project is a valid Exponentjs project");
                        }
                    });
                });
            });
    }

    /**
     * Executes the 'react-native run-android' command
     */
    public static runAndroid(target: "device" | "simulator" = "simulator"): Q.Promise<void> {
        TargetPlatformHelper.checkTargetPlatformSupport("android");
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.executeCommandInContext("runAndroid", project.workspaceFolder, () => this.executeWithPackagerRunning(project, () => {
                    const packagerPort = SettingsHelper.getPackagerPort(project.workspaceFolder.uri.path);
                    const runArgs = SettingsHelper.getRunArgs("android", target);
                    const platform = new AndroidPlatform({ platform: "android", workspaceRoot: project.workspaceFolder.uri.path, projectRoot: project.workspaceFolder.uri.path, packagerPort: packagerPort, runArguments: runArgs }, {
                        packager: project.reactNativePackager,
                    });
                    return platform.runApp(/*shouldLaunchInAllDevices*/true)
                        .then(() => {
                            return platform.disableJSDebuggingMode();
                        });
                }));
            });
    }

    /**
     * Executes the 'react-native run-ios' command
     */
    public static runIos(target: "device" | "simulator" = "simulator"): Q.Promise<void> {
        TargetPlatformHelper.checkTargetPlatformSupport("ios");
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.executeCommandInContext("runIos", project.workspaceFolder, () => this.executeWithPackagerRunning(project, () => {
                    const packagerPort = SettingsHelper.getPackagerPort(project.workspaceFolder.uri.path);
                    const runArgs = SettingsHelper.getRunArgs("ios", target);
                    const platform = new IOSPlatform({ platform: "ios", workspaceRoot: project.workspaceFolder.uri.path, projectRoot: project.workspaceFolder.uri.path, packagerPort, runArguments: runArgs }, { packager: project.reactNativePackager });

                    // Set the Debugging setting to disabled, because in iOS it's persisted across runs of the app
                    return platform.disableJSDebuggingMode()
                        .catch(() => { }) // If setting the debugging mode fails, we ignore the error and we run the run ios command anyways
                        .then(() => {
                            return platform.runApp();
                        });
                }));
            });
    }

    public static showDevMenu(): Q.Promise<void> {
        AndroidPlatform.showDevMenu()
                .catch(() => {}); // Ignore any errors
        // IOSPlatform.showDevMenu()
        //     .catch(() => {}); // Ignore any errors
        return Q.resolve(void 0);
    }

    public static reloadApp(): Q.Promise<void> {
        AndroidPlatform.reloadApp()
            .catch(() => {}); // Ignore any errors
        // IOSPlatform.reloadApp()
        //     .catch(() => {}); // Ignore any errors
        return Q.resolve(void 0);
    }

    private static runRestartPackagerCommandAndUpdateStatus(project: IReactNativeProject): Q.Promise<void> {
        return project.reactNativePackager.restart(SettingsHelper.getPackagerPort(project.workspaceFolder.uri.path))
            .then(() => project.reactNativePackager.statusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED));
    }

    /**
     * Helper method to run packager and update appropriate configurations
     */
    private static runStartPackagerCommandAndUpdateStatus(project: IReactNativeProject, startAs: PackagerRunAs = PackagerRunAs.REACT_NATIVE): Q.Promise<any> {
        if (startAs === PackagerRunAs.EXPONENT) {
            return this.loginToExponent(project)
                .then(() =>
                    project.reactNativePackager.startAsExponent()
                ).then(exponentUrl => {
                    project.reactNativePackager.statusIndicator.updatePackagerStatus(PackagerStatus.EXPONENT_PACKAGER_STARTED);
                    CommandPaletteHandler.logger.info("Application is running on Exponent.");
                    const exponentOutput = `Open your exponent app at ${exponentUrl}`;
                    CommandPaletteHandler.logger.info(exponentOutput);
                    vscode.commands.executeCommand("vscode.previewHtml", vscode.Uri.parse(exponentUrl), 1, "Expo QR code");
                });
        }
        return project.reactNativePackager.startAsReactNative()
            .then(() => project.reactNativePackager.statusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED));
    }

    /**
     * Executes a lambda function after starting the packager
     * {lambda} The lambda function to be executed
     */
    private static executeWithPackagerRunning(project: IReactNativeProject, lambda: () => Q.Promise<void>): Q.Promise<void> {
        // Start the packager before executing the React-Native command
        CommandPaletteHandler.logger.info("Attempting to start the React Native packager");
        return this.runStartPackagerCommandAndUpdateStatus(project).then(lambda);
    }

    /**
     * Ensures that we are in a React Native project and then executes the operation
     * Otherwise, displays an error message banner
     * {operation} - a function that performs the expected operation
     */
    private static executeCommandInContext(rnCommand: string, workspaceFolder: vscode.WorkspaceFolder, operation: () => Q.Promise<void>): Q.Promise<void> {
        return TelemetryHelper.generate("RNCommand", (generator) => {
            generator.add("command", rnCommand, false);
            return ReactNativeProjectHelper.isReactNativeProject(workspaceFolder.uri.path).then(isRNProject => {
                generator.add("isRNProject", isRNProject, false);
                if (isRNProject) {
                    // Bring the log channel to focus
                    CommandPaletteHandler.logger.setFocusOnLogChannel();

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
    private static executePublishToExpHost(project: IReactNativeProject): Q.Promise<boolean> {
        CommandPaletteHandler.logger.info("Publishing app to Exponent server. This might take a moment.");
        return this.loginToExponent(project)
            .then(user => {
                CommandPaletteHandler.logger.debug(`Publishing as ${user.username}...`);
                return this.startExponentPackager()
                    .then(() =>
                        XDL.publish(project.workspaceFolder.uri.path))
                    .then(response => {
                        if (response.err || !response.url) {
                            return false;
                        }
                        const publishedOutput = `App successfully published to ${response.url}`;
                        CommandPaletteHandler.logger.info(publishedOutput);
                        vscode.window.showInformationMessage(publishedOutput);
                        return true;
                    });
            }).catch(() => {
                CommandPaletteHandler.logger.warning("An error has occured. Please make sure you are logged in to exponent, your project is setup correctly for publishing and your packager is running as exponent.");
                return false;
            });
    }

    private static loginToExponent(project: IReactNativeProject): Q.Promise<XDL.IUser> {
        return project.exponentHelper.loginToExponent(
            (message, password) => {
                return Q.Promise((resolve, reject) => {
                    vscode.window.showInputBox({ placeHolder: message, password: password })
                        .then(login => {
                            resolve(login || "");
                        }, reject);
                });
            },
            (message) => {
                return Q.Promise((resolve, reject) => {
                    vscode.window.showInformationMessage(message)
                        .then(password => {
                            resolve(password || "");
                        }, reject);
                });
            }
        );
    }

    private static selectProject(): Q.Promise<IReactNativeProject> {
        let keys = Object.keys(this.projectsCache);
        if (keys.length > 1) {
            return Q.Promise((resolve, reject) => {
                vscode.window.showQuickPick(keys)
                    .then((selected) => {
                        if (selected) {
                            resolve(this.projectsCache[selected]);
                        } else {
                            reject("Cancel");
                        }
                    }, reject);
            });
        } else if (keys.length === 1) {
            return Q.resolve(this.projectsCache[keys[0]]);
        } else {
            return Q.reject();
        }
    }
}
