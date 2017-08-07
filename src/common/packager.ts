// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ChildProcess} from "child_process";
import {CommandExecutor} from "./commandExecutor";
import {ExponentHelper} from "./exponent/exponentHelper";
import {ErrorHelper} from "./error/errorHelper";
import {InternalErrorCode} from "./error/internalErrorCode";
import {Log} from "./log/log";
import {LogLevel} from "./log/logHelper";
import {Node} from "./node/node";
import {Package} from "./node/package";
import {PromiseUtil} from "./node/promise";
import {Request} from "./node/request";
import {ReactNativeProjectHelper} from "./reactNativeProjectHelper";

import * as Q from "q";
import * as path from "path";
import * as XDL from "../common/exponent/xdlInterface";
import * as url from "url";

export enum PackagerRunAs {
    REACT_NATIVE,
    EXPONENT,
    NOT_RUNNING
}

export class Packager {
    public static DEFAULT_PORT = 8081;
    private packagerProcess: ChildProcess;
    private packagerRunningAs: PackagerRunAs;

    private static JS_INJECTOR_FILENAME = "opn-main.js";
    private static JS_INJECTOR_FILEPATH = path.resolve(path.dirname(path.dirname(__dirname)), "js-patched", Packager.JS_INJECTOR_FILENAME);
    private static NODE_MODULES_FODLER_NAME = "node_modules";
    private static OPN_PACKAGE_NAME = "opn";
    private static REACT_NATIVE_PACKAGE_NAME = "react-native";
    private static OPN_PACKAGE_MAIN_FILENAME = "index.js";

    constructor(private workspacePath: string, private projectPath: string, private port: number) {
        this.packagerRunningAs = PackagerRunAs.NOT_RUNNING;
    }

    public static getHostForPort(port: number): string {
        return `localhost:${port}`;
    }

    public getHost(): string {
        return Packager.getHostForPort(this.port);
    }

    public getRunningAs(): PackagerRunAs {
        return this.packagerRunningAs;
    }

    public startAsReactNative(): Q.Promise<void> {
        return this.start(PackagerRunAs.REACT_NATIVE);
    }

    public startAsExponent(): Q.Promise<string> {
        return this.isRunning()
            .then(running => {
                if (running && this.packagerRunningAs === PackagerRunAs.REACT_NATIVE) {
                    return this.killPackagerProcess()
                        .then(() =>
                            this.start(PackagerRunAs.EXPONENT));
                } else if (running && this.packagerRunningAs === PackagerRunAs.NOT_RUNNING) {
                    Log.logWarning(ErrorHelper.getWarning("Packager running outside of VS Code. To avoid issues with exponent make sure it is running with .vscode/ as a root."));
                    return Q.resolve<void>(void 0);
                } else if (this.packagerRunningAs !== PackagerRunAs.EXPONENT) {
                    return this.start(PackagerRunAs.EXPONENT);
                } else {
                    return null;
                }
            })
            .then(() =>
                XDL.setOptions(this.projectPath, { packagerPort: this.port })
            )
            .then(() =>
                XDL.startExponentServer(this.projectPath)
            )
            .then(() =>
                XDL.startTunnels(this.projectPath)
            )
            .then(() =>
                XDL.getUrl(this.projectPath, { dev: true, minify: false })
            ).then(exponentUrl => {
                return "exp://" + url.parse(exponentUrl).host;
            })
            .catch(reason => {
                return Q.reject<string>(reason);
            });
    }

    public stop(): Q.Promise<void> {
        return this.isRunning()
            .then(running => {
                if (running) {
                    if (!this.packagerProcess) {
                        Log.logWarning(ErrorHelper.getWarning("Packager is still running. If the packager was started outside VS Code, please quit the packager process using the task manager."));
                        return Q.resolve<void>(void 0);
                    }
                    return this.killPackagerProcess();
                } else {
                    Log.logWarning(ErrorHelper.getWarning("Packager is not running"));
                    return Q.resolve<void>(void 0);
                }
            }).then(() => {
                this.packagerRunningAs = PackagerRunAs.NOT_RUNNING;
            });
    }

    public restart(port: number): Q.Promise<void> {
        if (this.port && this.port !== port) {
            return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.PackagerRunningInDifferentPort, port, this.port));
        }

        const currentRunningState = this.packagerRunningAs;

        return this.isRunning()
            .then(running => {
                if (running) {
                    if (!this.packagerProcess) {
                        Log.logWarning(ErrorHelper.getWarning("Packager is still running. If the packager was started outside VS Code, please quit the packager process using the task manager. Then try the restart packager again."));
                        return Q.resolve<boolean>(false);
                    }

                    return this.killPackagerProcess().then(() => Q.resolve<boolean>(true));
                } else {
                    Log.logWarning(ErrorHelper.getWarning("Packager is not running"));
                    return Q.resolve<boolean>(true);
                }
            })
            .then(stoppedOK => {
                if (stoppedOK) {
                    return this.start(currentRunningState,  true);
                } else {
                    return Q.resolve<void>(void 0);
                }
            });
    }

    public prewarmBundleCache(platform: string) {
        if (platform === "exponent") {
            return Q.resolve<void>(void 0);
        }
        return this.isRunning()
            .then(running => {
                return running ? this.prewarmBundleCacheWithBundleFilename(`index.${platform}`, platform) : null;
            });
    }

    public static isPackagerRunning(packagerURL: string): Q.Promise<boolean> {
        let statusURL = `http://${packagerURL}/status`;
        return Request.request(statusURL)
            .then((body: string) => {
                return body === "packager-status:running";
            },
            (error: any) => {
                return false;
            });
    }

    public isRunning(): Q.Promise<boolean> {
        return Packager.isPackagerRunning(this.getHost());
    }

    private prewarmBundleCacheWithBundleFilename(bundleFilename: string, platform: string) {
        const bundleURL = `http://${this.getHost()}/${bundleFilename}.bundle?platform=${platform}`;
        Log.logInternalMessage(LogLevel.Info, "About to get: " + bundleURL);
        return Request.request(bundleURL, true).then(() => {
            Log.logMessage("The Bundle Cache was prewarmed.");
        }).catch(() => {
            // The attempt to prefetch the bundle failed.
            // This may be because the bundle has a different name that the one we guessed so we shouldn't treat this as fatal.
        });
    }

    private start(runAs: PackagerRunAs, resetCache: boolean = false): Q.Promise<void> {
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

                            if (runAs !== PackagerRunAs.EXPONENT) {
                                return args;
                            }

                            args.push("--root", path.relative(this.projectPath, path.resolve(this.workspacePath, ".vscode")));

                            let helper = new ExponentHelper(this.workspacePath, this.projectPath);
                            return helper.getExpPackagerOptions()
                                .then((options: ExpConfigPackager) => {
                                    Object.keys(options).forEach(key => {
                                        args.concat([`--${key}`, options[key]]);
                                    });

                                    // Patch for CRNA
                                    if (args.indexOf("--assetExts") === -1) {
                                        args.push("--assetExts", "ttf");
                                    }

                                    return args;
                                })
                                .catch(() => {
                                    Log.logWarning("Couldn't read packager's options from exp.json, continue...");
                                    return args;
                                });
                        })
                        .then((args) => {
                            let reactNativeProjectHelper = new ReactNativeProjectHelper(this.projectPath);
                            reactNativeProjectHelper.getReactNativeVersion().then(version => {

                                //  There is a bug with launching VSCode editor for file from stack frame in 0.38, 0.39, 0.40 versions:
                                //  https://github.com/facebook/react-native/commit/f49093f39710173620fead6230d62cc670570210
                                //  This bug will be fixed in 0.41
                                const failedRNVersions: string[] = ["0.38.0", "0.39.0", "0.40.0"];

                                let reactEnv = Object.assign({}, process.env, {
                                    REACT_DEBUGGER: "echo A debugger is not needed: ",
                                    REACT_EDITOR: failedRNVersions.indexOf(version) < 0 ? "code" : this.openFileAtLocationCommand(),
                                });

                                Log.logMessage("Starting Packager");
                                // The packager will continue running while we debug the application, so we can"t
                                // wait for this command to finish

                                let spawnOptions = { env: reactEnv };

                                const packagerSpawnResult = new CommandExecutor(this.projectPath).spawnReactPackager(args, spawnOptions);
                                this.packagerProcess = packagerSpawnResult.spawnedProcess;
                                packagerSpawnResult.outcome.done(() => { }, () => { }); /* Q prints a warning if we don't call .done().
                                                                                        We ignore all outcome errors */
                                return packagerSpawnResult.startup;
                            });
                        });
                }
                return null;
            })
            .then(() =>
                this.awaitStart())
            .then(() => {
                if (executedStartPackagerCmd) {
                    Log.logMessage("Packager started.");
                    this.packagerRunningAs = runAs;
                } else {
                    Log.logMessage("Packager is already running.");
                    if (!this.packagerProcess) {
                        Log.logWarning(ErrorHelper.getWarning("React Native Packager running outside of VS Code. If you want to debug please use the 'Attach to packager' option"));
                    }
                }
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
            return Q.any(possiblePaths.map(path =>
                fsHelper.exists(path).then(exists =>
                    exists
                        ? Q.resolve(path)
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
                return null;
            });
    }

    private killPackagerProcess(): Q.Promise<void> {
        Log.logMessage("Stopping Packager");
        return new CommandExecutor(this.projectPath).killReactPackager(this.packagerProcess).then(() => {
            this.packagerProcess = null;
            if (this.packagerRunningAs === PackagerRunAs.EXPONENT) {
                Log.logMessage("Stopping Exponent");
                return XDL.stopAll(this.projectPath)
                    .then(() =>
                        Log.logMessage("Exponent Stopped")
                    );
            }
            return Q.resolve<void>(void 0);
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
