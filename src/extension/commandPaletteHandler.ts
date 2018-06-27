// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as XDL from "./exponent/xdlInterface";
import {SettingsHelper} from "./settingsHelper";
import {OutputChannelLogger} from "./log/OutputChannelLogger";
import {Packager} from "../common/packager";
import {TargetType} from "./generalMobilePlatform";
import {AndroidPlatform} from "./android/androidPlatform";
import {IOSPlatform} from "./ios/iOSPlatform";
import {ReactNativeProjectHelper} from "../common/reactNativeProjectHelper";
import {TargetPlatformHelper} from "../common/targetPlatformHelper";
import {TelemetryHelper} from "../common/telemetryHelper";
import {ExponentHelper} from "./exponent/exponentHelper";
import {ReactDirManager} from "./reactDirManager";
import {ExtensionServer} from "./extensionServer";
import {IAndroidRunOptions, IIOSRunOptions} from "./launchArgs";
import { ExponentPlatform } from "./exponent/exponentPlatform";

interface IReactNativeStuff {
    packager: Packager;
    exponentHelper: ExponentHelper;
    reactDirManager: ReactDirManager;
    extensionServer: ExtensionServer;
}

interface IReactNativeProject extends IReactNativeStuff {
    workspaceFolder: vscode.WorkspaceFolder;
}

export class CommandPaletteHandler {
    private static projectsCache: {[key: string]: IReactNativeProject} = {};
    private static logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();

    public static addFolder(workspaceFolder: vscode.WorkspaceFolder, stuff: IReactNativeStuff): void {
        this.projectsCache[workspaceFolder.uri.fsPath] = {
            ...stuff,
            workspaceFolder,
        };
    }

    public static getFolder(workspaceFolder: vscode.WorkspaceFolder): IReactNativeProject {
        return this.projectsCache[workspaceFolder.uri.fsPath];
    }

    public static delFolder(workspaceFolder: vscode.WorkspaceFolder): void {
        delete this.projectsCache[workspaceFolder.uri.fsPath];
    }

    /**
     * Starts the React Native packager
     */
    public static startPackager(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.executeCommandInContext("startPackager", project.workspaceFolder, () => {
                    return project.packager.isRunning()
                        .then((running) => {
                            return running ? project.packager.stop() : Q.resolve(void 0);
                        });
                })
                .then(() => project.packager.start());
            });
    }

    /**
     * Kills the React Native packager invoked by the extension's packager
     */
    public static stopPackager(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.executeCommandInContext("stopPackager", project.workspaceFolder, () => project.packager.stop());
            });
    }

    public static stopAllPackagers(): Q.Promise<void> {
        let keys = Object.keys(this.projectsCache);
        let promises: Q.Promise<void>[] = [];
        keys.forEach((key) => {
            let project = this.projectsCache[key];
            promises.push(this.executeCommandInContext("stopPackager", project.workspaceFolder, () => project.packager.stop()));
        });

        return Q.all(promises).then(() => {});
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
    public static runAndroid(target: TargetType = "simulator"): Q.Promise<void> {
        TargetPlatformHelper.checkTargetPlatformSupport("android");
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.executeCommandInContext("runAndroid", project.workspaceFolder, () => {
                    const runOptions = CommandPaletteHandler.getRunOptions(project, "android", target);
                    const platform = new AndroidPlatform(runOptions, {
                        packager: project.packager,
                    });
                    return platform.beforeStartPackager()
                        .then(() => {
                            return platform.startPackager();
                        })
                        .then(() => {
                            return platform.runApp(/*shouldLaunchInAllDevices*/true);
                        })
                        .then(() => {
                            return platform.disableJSDebuggingMode();
                        });
                });
            });
    }

    /**
     * Executes the 'react-native run-ios' command
     */
    public static runIos(target: TargetType = "simulator"): Q.Promise<void> {
        TargetPlatformHelper.checkTargetPlatformSupport("ios");
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.executeCommandInContext("runIos", project.workspaceFolder, () => {
                    const runOptions = CommandPaletteHandler.getRunOptions(project, "ios", target);
                    const platform = new IOSPlatform(runOptions, {
                        packager: project.packager,
                    });

                    return platform.beforeStartPackager()
                        .then(() => {
                            return platform.startPackager();
                        })
                        .then(() => {
                            // Set the Debugging setting to disabled, because in iOS it's persisted across runs of the app
                            return platform.disableJSDebuggingMode();
                        })
                        .catch(() => { }) // If setting the debugging mode fails, we ignore the error and we run the run ios command anyways
                        .then(() => {
                            return platform.runApp();
                        });
                });
            });
    }

    /**
     * Starts the Exponent packager
     */
    public static runExponent(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return this.loginToExponent(project)
                    .then(() => {
                        return this.executeCommandInContext("runExponent", project.workspaceFolder, () => {
                            const runOptions = CommandPaletteHandler.getRunOptions(project, "exponent");
                            const platform = new ExponentPlatform(runOptions, {
                                packager: project.packager,
                            });
                            return platform.beforeStartPackager()
                                .then(() => {
                                    return platform.startPackager();
                                })
                                .then(() => {
                                    return platform.runApp();
                                });
                        });
                    });
            });
    }

    public static showDevMenu(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                AndroidPlatform.showDevMenu()
                    .catch(() => { }); // Ignore any errors
                IOSPlatform.showDevMenu(project.workspaceFolder.uri.fsPath)
                    .catch(() => { }); // Ignore any errors
                return Q.resolve(void 0);
            });
    }

    public static reloadApp(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                AndroidPlatform.reloadApp()
                    .catch(() => { }); // Ignore any errors
                IOSPlatform.reloadApp(project.workspaceFolder.uri.fsPath)
                    .catch(() => { }); // Ignore any errors
                return Q.resolve(void 0);
            });
    }

    public static getPlatformByCommandName(commandName: string): string {
        commandName = commandName.toLocaleLowerCase();

        if (commandName.indexOf("android") > -1) {
            return "android";
        }

        if (commandName.indexOf("ios") > -1) {
            return "ios";
        }

        if (commandName.indexOf("exponent") > -1) {
            return "exponent";
        }

        return "";
    }

    private static runRestartPackagerCommandAndUpdateStatus(project: IReactNativeProject): Q.Promise<void> {
        return project.packager.restart(SettingsHelper.getPackagerPort(project.workspaceFolder.uri.fsPath));
    }

    /**
     * Ensures that we are in a React Native project and then executes the operation
     * Otherwise, displays an error message banner
     * {operation} - a function that performs the expected operation
     */
    private static executeCommandInContext(rnCommand: string, workspaceFolder: vscode.WorkspaceFolder, operation: () => Q.Promise<void>): Q.Promise<void> {
        const extProps = {
            platform: {
                value: CommandPaletteHandler.getPlatformByCommandName(rnCommand),
                isPii: false,
            },
        };

        return TelemetryHelper.generate("RNCommand", extProps, (generator) => {
            generator.add("command", rnCommand, false);
            const projectRoot = SettingsHelper.getReactNativeProjectRoot(workspaceFolder.uri.fsPath);
            return ReactNativeProjectHelper.isReactNativeProject(projectRoot).then(isRNProject => {
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
                return this.runExponent()
                    .then(() =>
                        XDL.publish(project.workspaceFolder.uri.fsPath))
                    .then(response => {
                        if (response.err || !response.url) {
                            return false;
                        }
                        const publishedOutput = `App successfully published to ${response.url}`;
                        CommandPaletteHandler.logger.info(publishedOutput);
                        vscode.window.showInformationMessage(publishedOutput);
                        return true;
                    });
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
        )
        .catch((err) => {
            CommandPaletteHandler.logger.warning("An error has occured. Please make sure you are logged in to exponent, your project is setup correctly for publishing and your packager is running as exponent.");
            throw err;
        });
    }

    private static selectProject(): Q.Promise<IReactNativeProject> {
        let keys = Object.keys(this.projectsCache);
        if (keys.length > 1) {
            return Q.Promise((resolve, reject) => {
                vscode.window.showQuickPick(keys)
                    .then((selected) => {
                        if (selected) {
                            resolve(this.projectsCache[selected]);
                        }
                    }, reject);
            });
        } else if (keys.length === 1) {
            return Q.resolve(this.projectsCache[keys[0]]);
        } else {
            return Q.reject(new Error("Current workspace is not a React Native project."));
        }
    }

    private static getRunOptions(project: IReactNativeProject, platform: "ios" | "android" | "exponent", target: TargetType = "simulator"): IAndroidRunOptions | IIOSRunOptions {
        const packagerPort = SettingsHelper.getPackagerPort(project.workspaceFolder.uri.fsPath);
        const runArgs = SettingsHelper.getRunArgs(platform, target, project.workspaceFolder.uri);
        const envArgs = SettingsHelper.getEnvArgs(platform, target, project.workspaceFolder.uri);
        const envFile = SettingsHelper.getEnvFile(platform, target, project.workspaceFolder.uri);
        const projectRoot = SettingsHelper.getReactNativeProjectRoot(project.workspaceFolder.uri.fsPath);
        const runOptions: IAndroidRunOptions | IIOSRunOptions = {
            platform: platform,
            workspaceRoot: project.workspaceFolder.uri.fsPath,
            projectRoot: projectRoot,
            packagerPort: packagerPort,
            runArguments: runArgs,
            env: envArgs,
            envFile: envFile,
        };

        return runOptions;
    }
}