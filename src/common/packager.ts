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
import * as semver from "semver";
import { FileSystem } from "./node/fileSystem";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();

export class Packager {
    public static DEFAULT_PORT = 8081;
    private packagerProcess: ChildProcess | undefined;
    private packagerStatus: PackagerStatus;
    private packagerStatusIndicator: PackagerStatusIndicator;
    private logger: OutputChannelLogger = OutputChannelLogger.getChannel(OutputChannelLogger.MAIN_CHANNEL_NAME, true);

    // old name for RN < 0.60.0, new for versions >= 0.60.0
    private static JS_INJECTOR_FILENAME = {
        new: "open-main.js",
        old: "opn-main.js",
    };
    private static RN_VERSION_WITH_OPEN_PKG = "0.60.0";
    private static JS_INJECTOR_DIRPATH = path.resolve(path.dirname(path.dirname(__dirname)), "js-patched");
    private static NODE_MODULES_FODLER_NAME = "node_modules";
    private static OPN_PACKAGE_NAME = {
        new: "open",
        old: "opn",
    };
    private static REACT_NATIVE_PACKAGE_NAME = "react-native";
    private static OPN_PACKAGE_MAIN_FILENAME = "index.js";
    private static fs: FileSystem = new Node.FileSystem();
    private expoHelper: ExponentHelper;

    constructor(private workspacePath: string, private projectPath: string, private packagerPort?: number, packagerStatusIndicator?: PackagerStatusIndicator) {
        this.packagerStatus = PackagerStatus.PACKAGER_STOPPED;
        this.packagerStatusIndicator = packagerStatusIndicator || new PackagerStatusIndicator();
        this.expoHelper = new ExponentHelper(this.workspacePath, this.projectPath);
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

    public getProjectPath(): string {
        return this.projectPath;
    }

    public getPackagerArgs(rnVersion: string, resetCache: boolean = false): Q.Promise<string[]> {
        let args: string[] = ["--port", this.port.toString()];

        if (resetCache) {
            args = args.concat("--resetCache");
        }

        return this.expoHelper.isExpoApp(false)
        .then((isExpo) => {
            if (!isExpo) {
                return args;
            }

            // Arguments below using for Expo apps
            if (!semver.gte(rnVersion, "0.57.0")) {
                args.push("--root", path.relative(this.projectPath, path.resolve(this.workspacePath, ".vscode")));
            }

            return this.expoHelper.getExpPackagerOptions()
            .then((options: ExpConfigPackager) => {
                Object.keys(options).forEach(key => {
                    args = args.concat([`--${key}`, options[key]]);
                });

                return args;
            })
            .catch(() => {
                this.logger.warning(localize("CouldNotReadPackagerOptions", "Couldn't read packager's options from exp.json, continue..."));

                return args;
            });
        });
    }

    public start(resetCache: boolean = false): Q.Promise<void> {
        this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTING);
        let executedStartPackagerCmd = false;
        let rnVersion: string;

        return this.isRunning()
        .then((running) => {
            if (running) {
                return void 0;
            }

            executedStartPackagerCmd = true;

            return ReactNativeProjectHelper.getReactNativeVersions(this.projectPath)
            .then((versions) => {
                rnVersion = versions.reactNativeVersion;
                return this.monkeyPatchOpnForRNPackager(rnVersion);
            })
            .then((version) => {
                return this.getPackagerArgs(rnVersion, resetCache);
            })
            .then((args) => {
                //  There is a bug with launching VSCode editor for file from stack frame in 0.38, 0.39, 0.40 versions:
                //  https://github.com/facebook/react-native/commit/f49093f39710173620fead6230d62cc670570210
                //  This bug will be fixed in 0.41
                const failedRNVersions: string[] = ["0.38.0", "0.39.0", "0.40.0"];

                let reactEnv = Object.assign({}, process.env, {
                    REACT_DEBUGGER: "echo A debugger is not needed: ",
                    REACT_EDITOR: failedRNVersions.indexOf(rnVersion) < 0 ? "code" : this.openFileAtLocationCommand(),
                });

                this.logger.info(localize("StartingPackager", "Starting Packager"));
                // The packager will continue running while we debug the application, so we can"t
                // wait for this command to finish

                let spawnOptions = { env: reactEnv };

                const packagerSpawnResult = new CommandExecutor(this.projectPath, this.logger).spawnReactPackager(args, spawnOptions);
                this.packagerProcess = packagerSpawnResult.spawnedProcess;
                packagerSpawnResult.outcome.done(() => { }, () => { }); // Q prints a warning if we don't call .done(). We ignore all outcome errors

                return packagerSpawnResult.startup;
            });
        })
        .then(() => {
            return this.awaitStart();
        })
        .then(() => {
            this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED);
            if (executedStartPackagerCmd) {
                this.logger.info(localize("PackagerStarted", "Packager started."));
                this.packagerStatus = PackagerStatus.PACKAGER_STARTED;
            } else {
                this.logger.info(localize("PackagerIsAlreadyRunning", "Packager is already running."));
                if (!this.packagerProcess) {
                    this.logger.warning(ErrorHelper.getWarning(localize("PackagerRunningOutsideVSCode", "React Native Packager running outside of VS Code. If you want to debug please use the 'Attach to packager' option")));
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
                            this.logger.warning(ErrorHelper.getWarning(localize("PackagerIsStillRunning", "Packager is still running. If the packager was started outside VS Code, please quit the packager process using the task manager.")));
                        }
                        return Q.resolve<void>(void 0);
                    }
                    return this.killPackagerProcess();
                } else {
                    if (!silent) {
                        this.logger.warning(ErrorHelper.getWarning(localize("PackagerIsNotRunning", "Packager is not running")));
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
                        this.logger.warning(ErrorHelper.getWarning(localize("PackagerIsStillRunning", "Packager is still running. If the packager was started outside VS Code, please quit the packager process using the task manager. Then try the restart packager again.")));
                        return Q.resolve<boolean>(false);
                    }

                    return this.killPackagerProcess().then(() => Q.resolve<boolean>(true));
                } else {
                    this.logger.warning(ErrorHelper.getWarning(localize("PackagerIsNotRunning", "Packager is not running")));
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
                        this.logger.info(localize("EntryPointDoesntExist", "Entry point doesn't exist neither at index.js nor index.{0}.js. Skip prewarming...", platform));
                        return;
                    }

                    const bundleURL = `http://${this.getHost()}/${bundleName}?platform=${platform}`;
                    this.logger.info(localize("AboutToGetURL", "About to get: {0}", bundleURL));
                    return Request.request(bundleURL, true)
                        .then(() => {
                            this.logger.warning(localize("BundleCacheWasPrewarmed", "The Bundle Cache was prewarmed."));
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
        return pu.retryAsync(() => this.isRunning(), (running) => running, retryCount, delay, localize("CouldNotStartPackager", "Could not start the packager."));
    }

    private findOpnPackage(ReactNativeVersion: string): Q.Promise<string> {
        try {
            let OPN_PACKAGE_NAME: string;
            if (semver.gte(ReactNativeVersion, Packager.RN_VERSION_WITH_OPEN_PKG)) {
                OPN_PACKAGE_NAME = Packager.OPN_PACKAGE_NAME.new;
            } else {
                OPN_PACKAGE_NAME = Packager.OPN_PACKAGE_NAME.old;
            }
            let flatDependencyPackagePath = path.resolve(this.projectPath, Packager.NODE_MODULES_FODLER_NAME,
                OPN_PACKAGE_NAME, Packager.OPN_PACKAGE_MAIN_FILENAME);

            let nestedDependencyPackagePath = path.resolve(this.projectPath, Packager.NODE_MODULES_FODLER_NAME,
                Packager.REACT_NATIVE_PACKAGE_NAME, Packager.NODE_MODULES_FODLER_NAME, OPN_PACKAGE_NAME, Packager.OPN_PACKAGE_MAIN_FILENAME);

            let fsHelper = new Node.FileSystem();

            // Attempt to find the 'opn' package directly under the project's node_modules folder (node4 +)
            // Else, attempt to find the package within the dependent node_modules of react-native package
            let possiblePaths = [flatDependencyPackagePath, nestedDependencyPackagePath];
            return Q.any(possiblePaths.map(fsPath =>
                fsHelper.exists(fsPath).then(exists =>
                    exists
                        ? Q.resolve(fsPath)
                        : Q.reject<string>(ErrorHelper.getInternalError(InternalErrorCode.OpnPackagerLocationNotFound)))));
        } catch (err) {
            return Q.reject<string>(ErrorHelper.getInternalError(InternalErrorCode.OpnPackagerNotFound, err));
        }
    }

    private monkeyPatchOpnForRNPackager(ReactNativeVersion: string): Q.Promise<void> {
        let opnPackage: Package;
        let destnFilePath: string;

        // Finds the 'opn' or 'open' package
        return this.findOpnPackage(ReactNativeVersion)
            .then((opnIndexFilePath) => {
                destnFilePath = opnIndexFilePath;
                // Read the package's "package.json"
                opnPackage = new Package(path.resolve(path.dirname(destnFilePath)));
                return opnPackage.parsePackageInformation();
            }).then((packageJson) => {
                let JS_INJECTOR_FILEPATH: string;
                let JS_INJECTOR_FILENAME: string;
                if (semver.gte(ReactNativeVersion, Packager.RN_VERSION_WITH_OPEN_PKG)) {
                    JS_INJECTOR_FILENAME = Packager.JS_INJECTOR_FILENAME.new;
                } else {
                    JS_INJECTOR_FILENAME = Packager.JS_INJECTOR_FILENAME.old;
                }
                JS_INJECTOR_FILEPATH = path.resolve(Packager.JS_INJECTOR_DIRPATH, JS_INJECTOR_FILENAME);
                if (packageJson.main !== JS_INJECTOR_FILENAME) {
                    // Copy over the patched 'opn' main file
                    return new Node.FileSystem().copyFile(JS_INJECTOR_FILEPATH, path.resolve(path.dirname(destnFilePath), JS_INJECTOR_FILENAME))
                        .then(() => {
                            // Write/over-write the "main" attribute with the new file
                            return opnPackage.setMainFile(JS_INJECTOR_FILENAME);
                        });
                }
                return Q.resolve(void 0);
            });
    }

    private killPackagerProcess(): Q.Promise<void> {
        this.logger.info(localize("StoppingPackager", "Stopping Packager"));
        return new CommandExecutor(this.projectPath, this.logger).killReactPackager(this.packagerProcess).then(() => {
            this.packagerProcess = undefined;

            let helper = new ExponentHelper(this.workspacePath, this.projectPath);

            return helper.isExpoApp(false)
            .then((isExpo) => {
                if (isExpo) {
                    this.logger.debug("Stopping Exponent");
                    return XDL.stopAll(this.projectPath)
                        .then(() => {
                            this.logger.debug("Exponent Stopped");
                        })
                        .catch((err) => {
                            if (err.code === "NOT_LOGGED_IN") {
                                return void(0);
                            }
                            throw err;
                        });
                } else {
                    return void(0);
                }
            });
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
