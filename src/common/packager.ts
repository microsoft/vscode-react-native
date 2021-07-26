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
import { AppLauncher } from "../extension/appLauncher";
import * as path from "path";
import * as XDL from "../extension/exponent/xdlInterface";
import * as semver from "semver";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { findFileInFolderHierarchy } from "./extensionHelper";
import { FileSystem } from "./node/fileSystem";
import { PromiseUtil } from "./node/promise";
import { CONTEXT_VARIABLES_NAMES } from "./contextVariablesNames";
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

    public async getPackagerArgs(
        projectRoot: string,
        rnVersion: string,
        resetCache: boolean = false,
    ): Promise<string[]> {
        let args: string[] = ["--port", this.getPort().toString()];

        if (resetCache) {
            args = args.concat("--resetCache");
        }

        const isExpo = await this.getExponentHelper().isExpoApp(false);
        if (isExpo) {
            // Arguments below using for Expo apps
            if (!semver.gte(rnVersion, "0.57.0")) {
                args.push(
                    "--root",
                    path.relative(this.projectPath, path.resolve(this.workspacePath, ".vscode")),
                );
            }

            try {
                const packagerOptions = await this.getExponentHelper().getExpPackagerOptions(
                    projectRoot,
                );
                Object.keys(packagerOptions).forEach(key => {
                    args = args.concat([`--${key}`, packagerOptions[key]]);
                });
            } catch (error) {
                this.logger.warning(
                    localize(
                        "CouldNotReadPackagerOptions",
                        "Couldn't read packager's options from exp.json, continue...",
                    ),
                );
            }
        }
        return args;
    }

    public async start(resetCache: boolean = false): Promise<void> {
        this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTING);
        let executedStartPackagerCmd = false;
        let rnVersion: string;

        if (!(await this.isRunning())) {
            executedStartPackagerCmd = true;

            const versions = await ProjectVersionHelper.getReactNativeVersions(this.projectPath);
            rnVersion = versions.reactNativeVersion;
            await this.monkeyPatchOpnForRNPackager(rnVersion);

            const args = await this.getPackagerArgs(this.projectPath, rnVersion, resetCache);
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

            const nodeModulesRoot: string = AppLauncher.getNodeModulesRootByProjectPath(
                this.projectPath,
            );

            const packagerSpawnResult = new CommandExecutor(
                nodeModulesRoot,
                this.projectPath,
                this.logger,
            ).spawnReactPackager(args, spawnOptions);
            this.packagerProcess = packagerSpawnResult.spawnedProcess;

            try {
                await packagerSpawnResult.outcome;
            } catch (error) {} // We ignore all outcome errors
        }

        await this.awaitStart();
        if (executedStartPackagerCmd) {
            this.logger.info(localize("PackagerStarted", "Packager started."));
            this.packagerStatus = PackagerStatus.PACKAGER_STARTED;
            vscode.commands.executeCommand(
                "setContext",
                CONTEXT_VARIABLES_NAMES.IS_RN_PACKAGER_RUNNING,
                true,
            );
        } else {
            this.logger.info(localize("PackagerIsAlreadyRunning", "Packager is already running."));
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
    }

    public async stop(silent: boolean = false): Promise<boolean> {
        this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPING);
        let successfullyStopped = false;

        if (await this.isRunning()) {
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
            } else {
                await this.killPackagerProcess();
                successfullyStopped = true;
            }
        } else {
            if (!silent) {
                this.logger.warning(
                    ErrorHelper.getWarning(
                        localize("PackagerIsNotRunning", "Packager is not running"),
                    ),
                );
            }
            successfullyStopped = true;
        }
        this.setPackagerStopStateUI();
        vscode.commands.executeCommand(
            "setContext",
            CONTEXT_VARIABLES_NAMES.IS_RN_PACKAGER_RUNNING,
            false,
        );
        return successfullyStopped;
    }

    public async restart(port: number): Promise<void> {
        if (this.getPort() && this.getPort() !== port) {
            throw ErrorHelper.getInternalError(
                InternalErrorCode.PackagerRunningInDifferentPort,
                port,
                this.getPort(),
            );
        }

        const successfullyStopped = await this.stop();
        if (successfullyStopped) {
            await this.start(true);
        }
    }

    public async prewarmBundleCache(platform: string): Promise<void> {
        if (platform === PlatformType.Exponent) {
            return;
        }

        if (await this.isRunning()) {
            const defaultIndex = path.resolve(this.projectPath, "index.js");
            const oldIndex = path.resolve(this.projectPath, `index.${platform}.js`); // react-native < 0.49.0

            try {
                const [defaultIndexExists, oldIndexExists] = await Promise.all([
                    Packager.fs.exists(defaultIndex),
                    Packager.fs.exists(oldIndex),
                ]);

                let bundleName = "";
                if (defaultIndexExists) {
                    bundleName = "index.bundle";
                } else if (oldIndexExists) {
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
                await Request.request(bundleURL, true);
                this.logger.warning(
                    localize("BundleCacheWasPrewarmed", "The Bundle Cache was prewarmed."),
                );
            } catch (error) {
                // The attempt to prefetch the bundle failed. This may be because the bundle has
                // a different name that the one we guessed so we shouldn't treat this as fatal.
            }
        }
    }

    public async isRunning(): Promise<boolean> {
        let statusURL = `http://${this.getHost()}/status`;
        try {
            const body = await Request.request(statusURL);
            return body === "packager-status:running";
        } catch (error) {
            return false;
        }
    }

    private awaitStart(retryCount = 60, delay = 3000): Promise<boolean> {
        return new PromiseUtil().retryAsync(
            () => this.isRunning(),
            running => running,
            retryCount,
            delay,
            localize("CouldNotStartPackager", "Could not start the packager."),
        );
    }

    private async findOpnPackage(ReactNativeVersion: string): Promise<string> {
        try {
            let OPN_PACKAGE_NAME: string;
            if (semver.gte(ReactNativeVersion, Packager.RN_VERSION_WITH_OPEN_PKG)) {
                OPN_PACKAGE_NAME = Packager.OPN_PACKAGE_NAME.new;
            } else {
                OPN_PACKAGE_NAME = Packager.OPN_PACKAGE_NAME.old;
            }

            const nodeModulesRoot: string = AppLauncher.getNodeModulesRootByProjectPath(
                this.projectPath,
            );

            let flatDependencyPackagePath = path.resolve(
                nodeModulesRoot,
                Packager.NODE_MODULES_FODLER_NAME,
                OPN_PACKAGE_NAME,
                Packager.OPN_PACKAGE_MAIN_FILENAME,
            );

            let nestedDependencyPackagePath = path.resolve(
                nodeModulesRoot,
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
            const paths = await Promise.all(
                possiblePaths.map(async fsPath => ((await fsHelper.exists(fsPath)) ? fsPath : "")),
            );
            const packagePath = paths.find(fsPath => {
                if (fsPath) {
                    return true;
                } else {
                    return false;
                }
            });
            if (packagePath) {
                return packagePath;
            }
            throw ErrorHelper.getInternalError(InternalErrorCode.OpnPackagerLocationNotFound);
        } catch (err) {
            throw ErrorHelper.getInternalError(InternalErrorCode.OpnPackagerNotFound, err);
        }
    }

    private async monkeyPatchOpnForRNPackager(ReactNativeVersion: string): Promise<void> {
        let opnPackage: Package;
        let destnFilePath: string;

        // Finds the 'opn' or 'open' package
        const opnIndexFilePath = await this.findOpnPackage(ReactNativeVersion);
        destnFilePath = opnIndexFilePath;
        // Read the package's "package.json"
        opnPackage = new Package(path.resolve(path.dirname(destnFilePath)));

        const packageJson = await opnPackage.parsePackageInformation();
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
            await new FileSystem().copyFile(
                JS_INJECTOR_FILEPATH,
                path.resolve(path.dirname(destnFilePath), JS_INJECTOR_FILENAME),
            );
            return opnPackage.setMainFile(JS_INJECTOR_FILENAME);
        }
    }

    private setPackagerStopStateUI() {
        this.packagerStatus = PackagerStatus.PACKAGER_STOPPED;
        this.packagerStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPED);
    }

    private async killPackagerProcess(): Promise<void> {
        this.logger.info(localize("StoppingPackager", "Stopping Packager"));

        const nodeModulesRoot: string = AppLauncher.getNodeModulesRootByProjectPath(
            this.projectPath,
        );

        await new CommandExecutor(nodeModulesRoot, this.projectPath, this.logger).killReactPackager(
            this.packagerProcess,
        );
        this.packagerProcess = undefined;
        if (await new ExponentHelper(this.workspacePath, this.projectPath).isExpoApp(false)) {
            this.logger.debug("Stopping Exponent");
            try {
                await XDL.stopAll(this.projectPath);
                this.logger.debug("Exponent Stopped");
            } catch (error) {
                if (error.code !== "NOT_LOGGED_IN") {
                    throw error;
                }
            }
        }
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
