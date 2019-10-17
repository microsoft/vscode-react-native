// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as path from "path";
import * as XDL from "./exponent/xdlInterface";
import {SettingsHelper} from "./settingsHelper";
import {OutputChannelLogger} from "./log/OutputChannelLogger";
import {Packager} from "../common/packager";
import {TargetType, GeneralMobilePlatform} from "./generalMobilePlatform";
import {AndroidPlatform} from "./android/androidPlatform";
import {IOSPlatform} from "./ios/iOSPlatform";
import {ReactNativeProjectHelper} from "../common/reactNativeProjectHelper";
import {TargetPlatformHelper} from "../common/targetPlatformHelper";
import {TelemetryHelper} from "../common/telemetryHelper";
import {ExponentHelper} from "./exponent/exponentHelper";
import {ReactDirManager} from "./reactDirManager";
import {ExtensionServer} from "./extensionServer";
import {IAndroidRunOptions, IIOSRunOptions} from "./launchArgs";
import {ExponentPlatform} from "./exponent/exponentPlatform";
import {spawn, ChildProcess} from "child_process";
import {HostPlatform} from "../common/hostPlatform";
import {CommandExecutor} from "../common/commandExecutor";
import * as nls from "vscode-nls";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalErrorCode} from "../common/error/internalErrorCode";
const localize = nls.loadMessageBundle();

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
    public static elementInspector: ChildProcess | null;
    private static projectsCache: {[key: string]: IReactNativeProject} = {};
    private static logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();

    public static addFolder(workspaceFolder: vscode.WorkspaceFolder, stuff: IReactNativeStuff): void {
        this.logger.debug(`Command palette: added folder ${workspaceFolder.uri.fsPath}`);
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
                return CommandPaletteHandler.checkReactNativePackageExistence(project.workspaceFolder.uri.path)
                    .then(version => {
                        return this.executeCommandInContext("startPackager", project.workspaceFolder, () => {
                            return project.packager.isRunning()
                                .then((running) => {
                                    return running ? project.packager.stop() : Q.resolve(void 0);
                                });
                        })
                        .then(() => project.packager.start());
                    });
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
                return CommandPaletteHandler.checkReactNativePackageExistence(project.workspaceFolder.uri.path)
                    .then(version => {
                        return this.executeCommandInContext("restartPackager", project.workspaceFolder, () =>
                            this.runRestartPackagerCommandAndUpdateStatus(project));
                    });
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
                            CommandPaletteHandler.logger.warning(localize("ExponentPublishingWasUnsuccessfulMakeSureYoureLoggedInToExpo", "Publishing was unsuccessful. Please make sure you are logged in Expo and your project is a valid Expo project"));
                        }
                    });
                });
            });
    }

    /**
     * Executes the 'react-native run-android' command
     */
    public static runAndroid(target: TargetType = "simulator"): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                TargetPlatformHelper.checkTargetPlatformSupport("android");
                return CommandPaletteHandler.checkReactNativePackageExistence(project.workspaceFolder.uri.path)
                    .then(version => {
                        return this.executeCommandInContext("runAndroid", project.workspaceFolder, () => {
                            const platform = <AndroidPlatform>this.createPlatform(project, "android", AndroidPlatform, target);
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
            });
    }

    /**
     * Executes the 'react-native run-ios' command
     */
    public static runIos(target: TargetType = "simulator"): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return CommandPaletteHandler.checkReactNativePackageExistence(project.workspaceFolder.uri.path)
                    .then(version => {
                    TargetPlatformHelper.checkTargetPlatformSupport("ios");
                    return this.executeCommandInContext("runIos", project.workspaceFolder, () => {
                        const platform = <IOSPlatform>this.createPlatform(project, "ios", IOSPlatform, target);
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
            });
    }

    /**
     * Starts the Exponent packager
     */
    public static runExponent(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                return CommandPaletteHandler.checkReactNativePackageExistence(project.workspaceFolder.uri.path)
                    .then(version => {
                        return this.loginToExponent(project)
                            .then(() => {
                                return this.executeCommandInContext("runExponent", project.workspaceFolder, () => {
                                    const platform = <ExponentPlatform>this.createPlatform(project, "exponent", ExponentPlatform);
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
            });
    }

    public static showDevMenu(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                const androidPlatform = <AndroidPlatform>this.createPlatform(project, "android", AndroidPlatform);
                androidPlatform.showDevMenu()
                    .catch(() => { }); // Ignore any errors

                if (process.platform === "darwin") {
                    const iosPlatform = <IOSPlatform>this.createPlatform(project, "ios", IOSPlatform);
                    iosPlatform.showDevMenu()
                        .catch(() => { }); // Ignore any errors
                }
                return Q.resolve(void 0);
            });
    }

    public static reloadApp(): Q.Promise<void> {
        return this.selectProject()
            .then((project: IReactNativeProject) => {
                const androidPlatform = <AndroidPlatform>this.createPlatform(project, "android", AndroidPlatform);
                androidPlatform.reloadApp()
                    .catch(() => { }); // Ignore any errors

                if (process.platform === "darwin") {
                    const iosPlatform = <IOSPlatform>this.createPlatform(project, "ios", IOSPlatform);
                    iosPlatform.reloadApp()
                        .catch(() => { }); // Ignore any errors
                }
                return Q.resolve(void 0);
            });
    }

    public static runElementInspector(): Q.Promise<void> {
        if (!CommandPaletteHandler.elementInspector) {
            // Remove the following env variables to prevent running electron app in node mode.
            // https://github.com/Microsoft/vscode/issues/3011#issuecomment-184577502
            let env = Object.assign({}, process.env);
            delete env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
            delete env.ELECTRON_RUN_AS_NODE;
            let command = HostPlatform.getNpmCliCommand("react-devtools");
            CommandPaletteHandler.elementInspector = spawn(command, [], {
                env,
            });
            if (!CommandPaletteHandler.elementInspector.pid) {
                CommandPaletteHandler.elementInspector = null;
                return Q.reject(ErrorHelper.getInternalError(InternalErrorCode.ReactDevtoolsIsNotInstalled));
            }
            CommandPaletteHandler.elementInspector.stdout.on("data", (data: string) => {
                this.logger.info(data);
            });
            CommandPaletteHandler.elementInspector.stderr.on("data", (data: string) => {
                this.logger.error(data);
            });
            CommandPaletteHandler.elementInspector.once("exit", () => {
                CommandPaletteHandler.elementInspector = null;
            });
        } else {
            this.logger.info(localize("AnotherElementInspectorAlreadyRun", "Another element inspector already run"));
        }
        return Q(void 0);
    }

    public static stopElementInspector(): void {
        return CommandPaletteHandler.elementInspector ? CommandPaletteHandler.elementInspector.kill() : void 0;
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

    private static createPlatform(project: IReactNativeProject, platform: "ios" | "android" | "exponent", platformClass: typeof GeneralMobilePlatform, target?: TargetType): GeneralMobilePlatform {
        const runOptions = CommandPaletteHandler.getRunOptions(project, platform, target);
        return new platformClass(runOptions, {
            packager: project.packager,
        });
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
            this.logger.debug(`Command palette: run project ${projectRoot} in context`);
            return ReactNativeProjectHelper.isReactNativeProject(projectRoot)
                .then(isRNProject => {
                    generator.add("isRNProject", isRNProject, false);
                    if (isRNProject) {
                        // Bring the log channel to focus
                        this.logger.setFocusOnLogChannel();

                        // Execute the operation
                        return operation();
                    } else {
                        vscode.window.showErrorMessage(`${projectRoot} workspace is not a React Native project.`);
                        return;
                    }
                });
        });
    }

    /**
     * Publish project to exponent server. In order to do this we need to make sure the user is logged in exponent and the packager is running.
     */
    private static executePublishToExpHost(project: IReactNativeProject): Q.Promise<boolean> {
        CommandPaletteHandler.logger.info(localize("PublishingAppToExponentServer", "Publishing app to Expo server. This might take a moment."));
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
                        const publishedOutput = localize("ExpoAppSuccessfullyPublishedTo", "Expo app successfully published to {0}", response.url);
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
            CommandPaletteHandler.logger.warning(localize("ExpoErrorOccuredMakeSureYouAreLoggedIn", "An error has occured. Please make sure you are logged in to Expo, your project is setup correctly for publishing and your packager is running as Expo."));
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
                            this.logger.debug(`Command palette: selected project ${selected}`);
                            resolve(this.projectsCache[selected]);
                        }
                    }, reject);
            });
        } else if (keys.length === 1) {
            this.logger.debug(`Command palette: once project ${keys[0]}`);
            return Q.resolve(this.projectsCache[keys[0]]);
        } else {
            return Q.reject(ErrorHelper.getInternalError(InternalErrorCode.WorkspaceNotFound, "Current workspace does not contain React Native projects."));
        }
    }

    private static checkReactNativePackageExistence(workspaceRoot: string): Q.Promise<string> {
        return ReactNativeProjectHelper.getReactNativePackageVersionFromNodeModules(
            path.resolve(workspaceRoot, "node_modules", "react-native")
            );
    }

    private static getRunOptions(project: IReactNativeProject, platform: "ios" | "android" | "exponent", target: TargetType = "simulator"): IAndroidRunOptions | IIOSRunOptions {
        const packagerPort = SettingsHelper.getPackagerPort(project.workspaceFolder.uri.fsPath);
        const runArgs = SettingsHelper.getRunArgs(platform, target, project.workspaceFolder.uri);
        const envArgs = SettingsHelper.getEnvArgs(platform, target, project.workspaceFolder.uri);
        const envFile = SettingsHelper.getEnvFile(platform, target, project.workspaceFolder.uri);
        const projectRoot = SettingsHelper.getReactNativeProjectRoot(project.workspaceFolder.uri.fsPath);
        const reactNativeGlobalCommandName = SettingsHelper.getReactNativeGlobalCommandName(project.workspaceFolder.uri);
        const runOptions: IAndroidRunOptions | IIOSRunOptions = {
            platform: platform,
            workspaceRoot: project.workspaceFolder.uri.fsPath,
            projectRoot: projectRoot,
            packagerPort: packagerPort,
            runArguments: runArgs,
            env: envArgs,
            envFile: envFile,
        };

        CommandExecutor.ReactNativeCommand = reactNativeGlobalCommandName;

        return runOptions;
    }
}
