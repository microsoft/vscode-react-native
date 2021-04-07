// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IRunOptions, PlatformType } from "./../extension/launchArgs";
import { GeneralMobilePlatform } from "./../extension/generalMobilePlatform";
import { ChildProcess } from "child_process";
import { CommandExecutor } from "./commandExecutor";
import { ExponentHelper } from "../extension/exponent/exponentHelper";
import { ErrorHelper } from "./error/errorHelper";
import { InternalErrorCode } from "./error/internalErrorCode";
import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";
import { Package } from "./node/package";
import { Request } from "./node/request";
import { ProjectVersionHelper } from "./projectVersionHelper";
import { PackagerStatusIndicator, PackagerStatus } from "../extension/packagerStatusIndicator";
import { SettingsHelper } from "../extension/settingsHelper";
import * as path from "path";
import * as XDL from "../extension/exponent/xdlInterface";
import * as semver from "semver";
import * as nls from "vscode-nls";
import { findFileInFolderHierarchy, getNodeModulesInFolderHierarhy } from "./extensionHelper";
import { FileSystem } from "./node/fileSystem";
import { PromiseUtil } from "./node/promise";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class Packager {
    public static DEFAULT_PORT = 8081;
    private packagerProcess: ChildProcess | undefined;
    private packagerStatus: PackagerStatus;
    private packagerStatusIndicator: PackagerStatusIndicator;
    private logger: OutputChannelLogger = OutputChannelLogger.getChannel(
        OutputChannelLogger.MAIN_CHANNEL_NAME,
        true,
    );

    // old name for RN < 0.60.0, new for versions >= 0.60.0
    private static JS_INJECTOR_FILENAME = {
        new: "open-main.js",
        old: "opn-main.js",
    };
    private static RN_VERSION_WITH_OPEN_PKG = "0.60.0";
    private static JS_INJECTOR_DIRPATH =
        findFileInFolderHierarchy(__dirname, "js-patched") || __dirname;
    private static NODE_MODULES_FODLER_NAME = "node_modules";
    private static OPN_PACKAGE_NAME = {
        new: "open",
        old: "opn",
    };
    private static REACT_NATIVE_PACKAGE_NAME = "react-native";
    private static OPN_PACKAGE_MAIN_FILENAME = "index.js";
    private static fs: FileSystem = new FileSystem();
    private expoHelper: ExponentHelper;
    private runOptions: IRunOptions;

    constructor(
        private workspacePath: string,
        private projectPath: string,
        private packagerPort?: number,
        packagerStatusIndicator?: PackagerStatusIndicator,
    ) {
        this.packagerStatus = PackagerStatus.PACKAGER_STOPPED;
        this.packagerStatusIndicator =
            packagerStatusIndicator || new PackagerStatusIndicator(projectPath);
    }

    public setExponentHelper(expoHelper: ExponentHelper): void {
        this.expoHelper = expoHelper;
    }

    public getExponentHelper(): ExponentHelper {
        if (!this.expoHelper) {
            this.expoHelper = new ExponentHelper(this.workspacePath, this.projectPath);
        }
        return this.expoHelper;
    }

    public getPort(): number {
        return this.packagerPort || SettingsHelper.getPackagerPort(this.workspacePath);
    }

    public setRunOptions(runOptions: IRunOptions): void {
        this.runOptions = runOptions;
    }

    public static getHostForPort(port: number): string {
        return `localhost:${port}`;
    }

    public getStatusIndicator(): PackagerStatusIndicator {
        return this.packagerStatusIndicator;
    }
    public getHost(): string {
        return Packager.getHostForPort(this.getPort());
    }

    public getPackagerStatus(): PackagerStatus {
        return this.packagerStatus;
    }

    public getProjectPath(): string {
        return this.projectPath;
    }

    public getPackagerArgs(
        projectRoot: string,
        rnVersion: string,
        resetCache: boolean = false,
    ): Promise<string[]> {
        let args: string[] = ["--port", this.getPort().toString()];

        if (resetCache) {
            args = args.concat("--resetCache");
        }

        return this.getExponentHelper()
            .isExpoApp(false)
            .then(isExpo => {
                if (!isExpo) {
                    return args;
                }

                // Arguments below using for Expo apps
                if (!semver.gte(rnVersion, "0.57.0")) {
                    args.push(
                        "--root",
                        path.relative(
                            this.projectPath,
                            path.resolve(this.workspacePath, ".vscode"),
                        ),
                    );
                }

                return this.getExponentHelper()
                    .getExpPackagerOptions(projectRoot)
                    .then((options: ExpMetroConfig) => {
                        Object.keys(options).forEach(key => {
                            args = args.concat([`--${key}`, options[key]]);
                        });

                        return args;
                    })
                    .catch(() => {
                        this.logger.warning(
                            localize(
                                "CouldNotReadPackagerOptions",
                                "Couldn't read packager's options from exp.json, continue...",
                            ),
                        );

                        return args;
                    });
            });
    }

    public start(resetCache: boolean = false): Promise<void> {
        this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTING);
        let executedStartPackagerCmd = false;
        let rnVersion: string;

        return this.isRunning()
            .then(running => {
                if (running) {
                    return void 0;
                }

                executedStartPackagerCmd = true;

                return ProjectVersionHelper.getReactNativeVersions(this.projectPath)
                    .then(versions => {
                        rnVersion = versions.reactNativeVersion;
                        return this.monkeyPatchOpnForRNPackager(rnVersion);
                    })
                    .then(() => {
                        return this.getPackagerArgs(this.projectPath, rnVersion, resetCache);
                    })
                    .then(args => {
                        //  There is a bug with launching VSCode editor for file from stack frame in 0.38, 0.39, 0.40 versions:
                        //  https://github.com/facebook/react-native/commit/f49093f39710173620fead6230d62cc670570210
                        //  This bug will be fixed in 0.41
                        const failedRNVersions: string[] = ["0.38.0", "0.39.0", "0.40.0"];

                        let env = Object.assign({}, process.env);
                        // CI="true" env property breaks RN fast refresh feature, so we need to remove it from default env variables
                        // See more info in the issue https://github.com/microsoft/vscode-react-native/issues/1529
                        delete env.CI;
                        if (this.runOptions && (this.runOptions.env || this.runOptions.envFile)) {
                            env = GeneralMobilePlatform.getEnvArgument(
                                env,
                                this.runOptions.env,
                                this.runOptions.envFile,
                            );
                        } else {
                            const rootEnv = path.join(this.getProjectPath(), ".env");
                            env = GeneralMobilePlatform.getEnvArgument(env, null, rootEnv);
                        }

                        let reactEnv = Object.assign({}, env, {
                            REACT_DEBUGGER: "echo A debugger is not needed: ",
                            REACT_EDITOR:
                                failedRNVersions.indexOf(rnVersion) < 0
                                    ? "code"
                                    : this.openFileAtLocationCommand(),
                        });

                        this.logger.info(localize("StartingPackager", "Starting Packager"));
                        // The packager will continue running while we debug the application, so we can"t
                        // wait for this command to finish

                        let spawnOptions = { env: reactEnv };

                        const packagerSpawnResult = new CommandExecutor(
                            this.projectPath,
                            this.logger,
                        ).spawnReactPackager(args, spawnOptions);
                        this.packagerProcess = packagerSpawnResult.spawnedProcess;
                        /* eslint-disable @typescript-eslint/no-empty-function */
                        packagerSpawnResult.outcome.then(
                            () => {},
                            () => {},
                        ); // We ignore all outcome errors
                        /* eslint-enable @typescript-eslint/no-empty-function */

                        return Promise.resolve();
                    });
            })
            .then(() => {
                return this.awaitStart();
            })
            .then(() => {
                if (executedStartPackagerCmd) {
                    this.logger.info(localize("PackagerStarted", "Packager started."));
                    this.packagerStatus = PackagerStatus.PACKAGER_STARTED;
                } else {
                    this.logger.info(
                        localize("PackagerIsAlreadyRunning", "Packager is already running."),
                    );
                    if (!this.packagerProcess) {
                        this.logger.warning(
                            ErrorHelper.getWarning(
                                localize(
                                    "PackagerRunningOutsideVSCode",
                                    "React Native Packager running outside of VS Code. If you want to debug please use the 'Attach to packager' option",
                                ),
                            ),
                        );
                        this.setPackagerStopStateUI();
                        return;
                    }
                }
                this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED);
            });
    }

    public stop(silent: boolean = false): Promise<any> {
        this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPING);
        return this.isRunning()
            .then(running => {
                if (running) {
                    if (!this.packagerProcess) {
                        if (!silent) {
                            this.logger.warning(
                                ErrorHelper.getWarning(
                                    localize(
                                        "PackagerIsStillRunning",
                                        "Packager is still running. If the packager was started outside VS Code, please quit the packager process using the task manager.",
                                    ),
                                ),
                            );
                        }
                        return Promise.resolve();
                    }
                    return this.killPackagerProcess();
                } else {
                    if (!silent) {
                        this.logger.warning(
                            ErrorHelper.getWarning(
                                localize("PackagerIsNotRunning", "Packager is not running"),
                            ),
                        );
                    }
                    return Promise.resolve();
                }
            })
            .then(() => {
                this.setPackagerStopStateUI();
            });
    }

    public restart(port: number): Promise<void> {
        if (this.getPort() && this.getPort() !== port) {
            return Promise.reject<void>(
                ErrorHelper.getInternalError(
                    InternalErrorCode.PackagerRunningInDifferentPort,
                    port,
                    this.getPort(),
                ),
            );
        }

        return this.isRunning()
            .then(running => {
                if (running) {
                    if (!this.packagerProcess) {
                        this.logger.warning(
                            ErrorHelper.getWarning(
                                localize(
                                    "PackagerIsStillRunning",
                                    "Packager is still running. If the packager was started outside VS Code, please quit the packager process using the task manager. Then try the restart packager again.",
                                ),
                            ),
                        );
                        return Promise.resolve<boolean>(false);
                    }

                    return this.killPackagerProcess().then(() => Promise.resolve<boolean>(true));
                } else {
                    this.logger.warning(
                        ErrorHelper.getWarning(
                            localize("PackagerIsNotRunning", "Packager is not running"),
                        ),
                    );
                    return Promise.resolve<boolean>(true);
                }
            })
            .then(stoppedOK => {
                if (stoppedOK) {
                    return this.start(true);
                } else {
                    return Promise.resolve();
                }
            });
    }

    public prewarmBundleCache(platform: string): Promise<void> {
        if (platform === PlatformType.Exponent) {
            return Promise.resolve();
        }

        return this.isRunning().then(running => {
            if (!running) {
                return void 0;
            }
            const defaultIndex = path.resolve(this.projectPath, "index.js");
            const oldIndex = path.resolve(this.projectPath, `index.${platform}.js`); // react-native < 0.49.0

            return Promise.all([Packager.fs.exists(defaultIndex), Packager.fs.exists(oldIndex)])
                .then(exists => {
                    let bundleName = "";
                    if (exists[0]) {
                        bundleName = "index.bundle";
                    } else if (exists[1]) {
                        bundleName = `index.${platform}.bundle`;
                    } else {
                        this.logger.info(
                            localize(
                                "EntryPointDoesntExist",
                                "Entry point doesn't exist neither at index.js nor index.{0}.js. Skip prewarming...",
                                platform,
                            ),
                        );
                        return;
                    }

                    const bundleURL = `http://${this.getHost()}/${bundleName}?platform=${platform}`;
                    this.logger.info(localize("AboutToGetURL", "About to get: {0}", bundleURL));
                    return Request.request(bundleURL, true).then(() => {
                        this.logger.warning(
                            localize("BundleCacheWasPrewarmed", "The Bundle Cache was prewarmed."),
                        );
                    });
                })
                .catch(() => {
                    // The attempt to prefetch the bundle failed. This may be because the bundle has
                    // a different name that the one we guessed so we shouldn't treat this as fatal.
                });
        });
    }

    public isRunning(): Promise<boolean> {
        let statusURL = `http://${this.getHost()}/status`;
        return Request.request(statusURL).then(
            (body: string) => {
                return body === "packager-status:running";
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (error: any) => {
                return false;
            },
        );
    }

    private awaitStart(retryCount = 60, delay = 3000): Promise<boolean> {
        let pu: PromiseUtil = new PromiseUtil();
        return pu.retryAsync(
            () => this.isRunning(),
            running => running,
            retryCount,
            delay,
            localize("CouldNotStartPackager", "Could not start the packager."),
        );
    }

    private findOpnPackage(ReactNativeVersion: string): Promise<string> {
        try {
            let OPN_PACKAGE_NAME: string;
            if (semver.gte(ReactNativeVersion, Packager.RN_VERSION_WITH_OPEN_PKG)) {
                OPN_PACKAGE_NAME = Packager.OPN_PACKAGE_NAME.new;
            } else {
                OPN_PACKAGE_NAME = Packager.OPN_PACKAGE_NAME.old;
            }

            const nodeModulesParentPath = getNodeModulesInFolderHierarhy(this.projectPath);

            let flatDependencyPackagePath = path.resolve(
                nodeModulesParentPath,
                Packager.NODE_MODULES_FODLER_NAME,
                OPN_PACKAGE_NAME,
                Packager.OPN_PACKAGE_MAIN_FILENAME,
            );

            let nestedDependencyPackagePath = path.resolve(
                nodeModulesParentPath,
                Packager.NODE_MODULES_FODLER_NAME,
                Packager.REACT_NATIVE_PACKAGE_NAME,
                Packager.NODE_MODULES_FODLER_NAME,
                OPN_PACKAGE_NAME,
                Packager.OPN_PACKAGE_MAIN_FILENAME,
            );

            let fsHelper = new FileSystem();

            // Attempt to find the 'opn' package directly under the project's node_modules folder (node4 +)
            // Else, attempt to find the package within the dependent node_modules of react-native package
            let possiblePaths = [flatDependencyPackagePath, nestedDependencyPackagePath];
            return Promise.all(
                possiblePaths.map(fsPath =>
                    fsHelper
                        .exists(fsPath)
                        .then(exists => (exists ? Promise.resolve(fsPath) : Promise.resolve(""))),
                ),
            ).then(paths => {
                const packagePath = paths.find(fsPath => {
                    if (fsPath) {
                        return true;
                    } else {
                        return false;
                    }
                });
                if (packagePath) {
                    return Promise.resolve(packagePath);
                }
                return Promise.reject(
                    ErrorHelper.getInternalError(InternalErrorCode.OpnPackagerLocationNotFound),
                );
            });
        } catch (err) {
            return Promise.reject<string>(
                ErrorHelper.getInternalError(InternalErrorCode.OpnPackagerNotFound, err),
            );
        }
    }

    private monkeyPatchOpnForRNPackager(ReactNativeVersion: string): Promise<void> {
        let opnPackage: Package;
        let destnFilePath: string;

        // Finds the 'opn' or 'open' package
        return this.findOpnPackage(ReactNativeVersion)
            .then(opnIndexFilePath => {
                destnFilePath = opnIndexFilePath;
                // Read the package's "package.json"
                opnPackage = new Package(path.resolve(path.dirname(destnFilePath)));
                return opnPackage.parsePackageInformation();
            })
            .then(packageJson => {
                let JS_INJECTOR_FILEPATH: string;
                let JS_INJECTOR_FILENAME: string;
                if (semver.gte(ReactNativeVersion, Packager.RN_VERSION_WITH_OPEN_PKG)) {
                    JS_INJECTOR_FILENAME = Packager.JS_INJECTOR_FILENAME.new;
                } else {
                    JS_INJECTOR_FILENAME = Packager.JS_INJECTOR_FILENAME.old;
                }
                JS_INJECTOR_FILEPATH = path.resolve(
                    Packager.JS_INJECTOR_DIRPATH,
                    JS_INJECTOR_FILENAME,
                );
                if (packageJson.main !== JS_INJECTOR_FILENAME) {
                    // Copy over the patched 'opn' main file
                    return new FileSystem()
                        .copyFile(
                            JS_INJECTOR_FILEPATH,
                            path.resolve(path.dirname(destnFilePath), JS_INJECTOR_FILENAME),
                        )
                        .then(() => {
                            // Write/over-write the "main" attribute with the new file
                            return opnPackage.setMainFile(JS_INJECTOR_FILENAME);
                        });
                }
                return Promise.resolve();
            });
    }

    private setPackagerStopStateUI() {
        this.packagerStatus = PackagerStatus.PACKAGER_STOPPED;
        this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPED);
    }

    private killPackagerProcess(): Promise<void> {
        this.logger.info(localize("StoppingPackager", "Stopping Packager"));
        return new CommandExecutor(this.projectPath, this.logger)
            .killReactPackager(this.packagerProcess)
            .then(() => {
                this.packagerProcess = undefined;

                let helper = new ExponentHelper(this.workspacePath, this.projectPath);

                return helper.isExpoApp(false).then(isExpo => {
                    if (isExpo) {
                        this.logger.debug("Stopping Exponent");
                        return XDL.stopAll(this.projectPath)
                            .then(() => {
                                this.logger.debug("Exponent Stopped");
                            })
                            .catch(err => {
                                if (err.code === "NOT_LOGGED_IN") {
                                    return void 0;
                                }
                                throw err;
                            });
                    } else {
                        return void 0;
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
