// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ChildProcess} from "child_process";
import {CommandExecutor} from "./commandExecutor";
import {ExponentHelper} from "../extension/exponent/exponentHelper";
import {ErrorHelper} from "./error/errorHelper";
import {InternalErrorCode} from "./error/internalErrorCode";
import {OutputChannelLogger} from "../extension/log/OutputChannelLogger";
import {Node} from "./node/node";
import {Package} from "./node/package";
import {PromiseUtil} from "./node/promise";
import {Request} from "./node/request";
import {ReactNativeProjectHelper} from "./reactNativeProjectHelper";
import {PackagerStatusIndicator, PackagerStatus} from "../extension/packagerStatusIndicator";
import {SettingsHelper} from "../extension/settingsHelper";

import * as Q from "q";
import * as path from "path";
import * as XDL from "../extension/exponent/xdlInterface";
import { FileSystem } from "./node/fileSystem";

export class Packager {
    public static DEFAULT_PORT = 8081;
    private packagerProcess: ChildProcess | undefined;
    private packagerStatus: PackagerStatus;
    private packagerStatusIndicator: PackagerStatusIndicator;
    private logger: OutputChannelLogger = OutputChannelLogger.getChannel(OutputChannelLogger.MAIN_CHANNEL_NAME, true);

    private static JS_INJECTOR_FILENAME = "opn-main.js";
    private static JS_INJECTOR_FILEPATH = path.resolve(path.dirname(path.dirname(__dirname)), "js-patched", Packager.JS_INJECTOR_FILENAME);
    private static NODE_MODULES_FODLER_NAME = "node_modules";
    private static OPN_PACKAGE_NAME = "opn";
    private static REACT_NATIVE_PACKAGE_NAME = "react-native";
    private static OPN_PACKAGE_MAIN_FILENAME = "index.js";
    private static fs: FileSystem = new Node.FileSystem();

    constructor(private workspacePath: string, private projectPath: string, private packagerPort?: number, packagerStatusIndicator?: PackagerStatusIndicator) {
        this.packagerStatus = PackagerStatus.PACKAGER_STOPPED;
        this.packagerStatusIndicator = packagerStatusIndicator || new PackagerStatusIndicator();
    }

    public get port(): number {
        return this.packagerPort || SettingsHelper.getPackagerPort(this.workspacePath);
    }

    public static getHostForPort(port: number): string {
        return `localhost:${port}`;
    }

    public get statusIndicator(): PackagerStatusIndicator {
        return this.packagerStatusIndicator;
    }
    public getHost(): string {
        return Packager.getHostForPort(this.port);
    }

    public getPackagerStatus(): PackagerStatus {
        return this.packagerStatus;
    }

    public start(resetCache: boolean = false): Q.Promise<void> {
        this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTING);
        let executedStartPackagerCmd = false;
        return this.isRunning()
            .then(running => {
                if (!running) {
                    executedStartPackagerCmd = true;
                    return this.monkeyPatchOpnForRNPackager()
                        .then(() => {
                            let args: string[] = ["--port", this.port.toString()];
                            if (resetCache) {
                                args = args.concat("--resetCache");
                }

                            // Arguments below using for Expo apps
                            args.push("--root", path.relative(this.projectPath, path.resolve(this.workspacePath, ".vscode")));
                            let helper = new ExponentHelper(this.workspacePath, this.projectPath);
                            return helper.getExpPackagerOptions()
                                .then((options: ExpConfigPackager) => {
                                    Object.keys(options).forEach(key => {
                                        args = args.concat([`--${key}`, options[key]]);
                                    });

                                    // Patch for CRNA
                                    if (args.indexOf("--assetExts") === -1) {
                                        args.push("--assetExts", "ttf");
                                    }

                                    return args;
            })
                                .catch(() => {
                                    this.logger.warning("Couldn't read packager's options from exp.json, continue...");
                                    return args;
                                });
                        })
                        .then((args) => {
                            const projectRoot = SettingsHelper.getReactNativeProjectRoot(this.workspacePath);
                            ReactNativeProjectHelper.getReactNativeVersion(projectRoot).then(version => {

                                //  There is a bug with launching VSCode editor for file from stack frame in 0.38, 0.39, 0.40 versions:
                                //  https://github.com/facebook/react-native/commit/f49093f39710173620fead6230d62cc670570210
                                //  This bug will be fixed in 0.41
                                const failedRNVersions: string[] = ["0.38.0", "0.39.0", "0.40.0"];

                                let reactEnv = Object.assign({}, process.env, {
                                    REACT_DEBUGGER: "echo A debugger is not needed: ",
                                    REACT_EDITOR: failedRNVersions.indexOf(version) < 0 ? "code" : this.openFileAtLocationCommand(),
                                });

                                this.logger.info("Starting Packager");
                                // The packager will continue running while we debug the application, so we can"t
                                // wait for this command to finish

                                let spawnOptions = { env: reactEnv };

                                const packagerSpawnResult = new CommandExecutor(this.projectPath, this.logger).spawnReactPackager(args, spawnOptions);
                                this.packagerProcess = packagerSpawnResult.spawnedProcess;
                                packagerSpawnResult.outcome.done(() => { }, () => { }); /* Q prints a warning if we don't call .done().
                                                                                        We ignore all outcome errors */
                                return packagerSpawnResult.startup;
                            });
                        });
                }
                return void 0;
            })
            .then(() =>
                this.awaitStart())
            .then(() => {
                this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED);
                if (executedStartPackagerCmd) {
                    this.logger.info("Packager started.");
                    this.packagerStatus = PackagerStatus.PACKAGER_STARTED;
                } else {
                    this.logger.info("Packager is already running.");
                    if (!this.packagerProcess) {
                        this.logger.warning(ErrorHelper.getWarning("React Native Packager running outside of VS Code. If you want to debug please use the 'Attach to packager' option"));
                    }
                }
            });
    }

    public stop(silent: boolean = false): Q.Promise<void> {
        this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPING);
        return this.isRunning()
            .then(running => {
                if (running) {
                    if (!this.packagerProcess) {
                        if (!silent) {
                            this.logger.warning(ErrorHelper.getWarning("Packager is still running. If the packager was started outside VS Code, please quit the packager process using the task manager."));
                        }
                        return Q.resolve<void>(void 0);
                    }
                    return this.killPackagerProcess();
                } else {
                    if (!silent) {
                        this.logger.warning(ErrorHelper.getWarning("Packager is not running"));
                    }
                    return Q.resolve<void>(void 0);
                }
            }).then(() => {
                this.packagerStatus = PackagerStatus.PACKAGER_STOPPED;
                this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPED);
            });
    }

    public restart(port: number): Q.Promise<void> {
        if (this.port && this.port !== port) {
            return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.PackagerRunningInDifferentPort, port, this.port));
        }

        return this.isRunning()
            .then(running => {
                if (running) {
                    if (!this.packagerProcess) {
                        this.logger.warning(ErrorHelper.getWarning("Packager is still running. If the packager was started outside VS Code, please quit the packager process using the task manager. Then try the restart packager again."));
                        return Q.resolve<boolean>(false);
                    }

                    return this.killPackagerProcess().then(() => Q.resolve<boolean>(true));
                } else {
                    this.logger.warning(ErrorHelper.getWarning("Packager is not running"));
                    return Q.resolve<boolean>(true);
                }
            })
            .then(stoppedOK => {
                if (stoppedOK) {
                    return this.start(true);
                } else {
                    return Q.resolve<void>(void 0);
                }
            });
    }

    public prewarmBundleCache(platform: string): Q.Promise<void> {
        if (platform === "exponent") {
            return Q.resolve(void 0);
        }

        return this.isRunning()
            .then(running => {
                if (!running) {
                    return void 0;
                }
                const defaultIndex = path.resolve(this.projectPath, "index.js");
                const oldIndex = path.resolve(this.projectPath, `index.${platform}.js`); // react-native < 0.49.0

                return Q.all([Packager.fs.exists(defaultIndex), Packager.fs.exists(oldIndex)])
                .then((exists) => {
                    let bundleName = "";
                    if (exists[0]) {
                        bundleName = "index.bundle";
                    } else if (exists[1]) {
                        bundleName = `index.${platform}.bundle`;
                    } else {
                        this.logger.info(`Entry point doesn't exist neither at index.js nor index.${platform}.js. Skip prewarming...`);
                        return;
                    }

                    const bundleURL = `http://${this.getHost()}/${bundleName}?platform=${platform}`;
                    this.logger.info("About to get: " + bundleURL);
                    return Request.request(bundleURL, true)
                        .then(() => {
                            this.logger.warning("The Bundle Cache was prewarmed.");
                        });
                })
                .catch(() => {
                    // The attempt to prefetch the bundle failed. This may be because the bundle has
                    // a different name that the one we guessed so we shouldn't treat this as fatal.
                });
            });
    }

    public isRunning(): Q.Promise<boolean> {
        let statusURL = `http://${this.getHost()}/status`;
        return Request.request(statusURL)
            .then((body: string) => {
                return body === "packager-status:running";
            },
            (error: any) => {
                return false;
            });
    }

    private awaitStart(retryCount = 30, delay = 2000): Q.Promise<boolean> {
        let pu: PromiseUtil = new PromiseUtil();
        return pu.retryAsync(() => this.isRunning(), (running) => running, retryCount, delay, "Could not start the packager.");
    }

    private findOpnPackage(): Q.Promise<string> {
        try {
            let flatDependencyPackagePath = path.resolve(this.projectPath, Packager.NODE_MODULES_FODLER_NAME,
                Packager.OPN_PACKAGE_NAME, Packager.OPN_PACKAGE_MAIN_FILENAME);

            let nestedDependencyPackagePath = path.resolve(this.projectPath, Packager.NODE_MODULES_FODLER_NAME,
                Packager.REACT_NATIVE_PACKAGE_NAME, Packager.NODE_MODULES_FODLER_NAME, Packager.OPN_PACKAGE_NAME, Packager.OPN_PACKAGE_MAIN_FILENAME);

            let fsHelper = new Node.FileSystem();

            // Attempt to find the 'opn' package directly under the project's node_modules folder (node4 +)
            // Else, attempt to find the package within the dependent node_modules of react-native package
            let possiblePaths = [flatDependencyPackagePath, nestedDependencyPackagePath];
            return Q.any(possiblePaths.map(fsPath =>
                fsHelper.exists(fsPath).then(exists =>
                    exists
                        ? Q.resolve(fsPath)
                        : Q.reject<string>("opn package location not found"))));
        } catch (err) {
            return Q.reject<string>("The package 'opn' was not found. " + err);
        }
    }

    private monkeyPatchOpnForRNPackager(): Q.Promise<void> {
        let opnPackage: Package;
        let destnFilePath: string;

        // Finds the 'opn' package
        return this.findOpnPackage()
            .then((opnIndexFilePath) => {
                destnFilePath = opnIndexFilePath;
                // Read the package's "package.json"
                opnPackage = new Package(path.resolve(path.dirname(destnFilePath)));
                return opnPackage.parsePackageInformation();
            }).then((packageJson) => {
                if (packageJson.main !== Packager.JS_INJECTOR_FILENAME) {
                    // Copy over the patched 'opn' main file
                    return new Node.FileSystem().copyFile(Packager.JS_INJECTOR_FILEPATH, path.resolve(path.dirname(destnFilePath), Packager.JS_INJECTOR_FILENAME))
                        .then(() => {
                            // Write/over-write the "main" attribute with the new file
                            return opnPackage.setMainFile(Packager.JS_INJECTOR_FILENAME);
                        });
                }
                return Q.resolve(void 0);
            });
    }

    private killPackagerProcess(): Q.Promise<void> {
        this.logger.info("Stopping Packager");
        return new CommandExecutor(this.projectPath, this.logger).killReactPackager(this.packagerProcess).then(() => {
            this.packagerProcess = undefined;
            this.logger.debug("Stopping Exponent");
            return XDL.stopAll(this.projectPath)
                .then(() =>
                    this.logger.debug("Exponent Stopped")
                );
        });
    }

    private openFileAtLocationCommand(): string {
        let atomScript: string = "node " + path.join(__dirname, "..", "..", "scripts", "atom");

        //  shell-quote package incorrectly parses windows paths
        //  https://github.com/facebook/react-native/blob/master/local-cli/server/util/launchEditor.js#L83
        if (process.platform === "win32") {
            return atomScript.replace(/\\/g, "/");
        }

        return atomScript;
    }
}
