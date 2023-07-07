// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ChildProcess } from "child_process";
import * as path from "path";
import * as assert from "assert";
import * as semver from "semver";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import * as WebSocket from "ws";
import { GeneralPlatform } from "../extension/generalPlatform";
import { ExponentHelper } from "../extension/exponent/exponentHelper";
import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";
import { PackagerStatusIndicator, PackagerStatus } from "../extension/packagerStatusIndicator";
import { SettingsHelper } from "../extension/settingsHelper";
import { AppLauncher } from "../extension/appLauncher";
import * as XDL from "../extension/exponent/xdlInterface";
import { IRunOptions, PlatformType } from "../extension/launchArgs";
import { CommandExecutor } from "./commandExecutor";
import { ErrorHelper } from "./error/errorHelper";
import { InternalErrorCode } from "./error/internalErrorCode";
import { Package } from "./node/package";
import { Request } from "./node/request";
import { ProjectVersionHelper } from "./projectVersionHelper";
import { findFileInFolderHierarchy } from "./extensionHelper";
import { FileSystem } from "./node/fileSystem";
import { PromiseUtil } from "./node/promise";
import { CONTEXT_VARIABLES_NAMES } from "./contextVariablesNames";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

interface MetroEventData {
    data: any;
    type: string;
    level: string;
    mode: string;
}

export class Packager {
    public static DEFAULT_PORT = 8081;
    private packagerSocket?: WebSocket;
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
    private runOptions?: IRunOptions;

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

    public closeWsConnection(): void {
        this.packagerSocket?.close();
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

        const isExpo = await this.getExponentHelper().isExpoManagedApp(false);
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
            if (this.packagerProcess) {
                this.logger.warning(
                    ErrorHelper.getWarning(
                        localize(
                            "PackagerIsRunningBeforeStarting",
                            "Packager is already running. If you want to debug please use the 'Attach to packager' option.",
                        ),
                    ),
                );
                return;
            }

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
                env = GeneralPlatform.getEnvArgument(
                    env,
                    this.runOptions.env,
                    this.runOptions.envFile,
                );
            } else {
                const rootEnv = path.join(this.getProjectPath(), ".env");
                env = GeneralPlatform.getEnvArgument(env, null, rootEnv);
            }

            const reactEnv = Object.assign({}, env, {
                REACT_DEBUGGER: "echo A debugger is not needed: ",
                REACT_EDITOR: !failedRNVersions.includes(rnVersion)
                    ? "code"
                    : this.openFileAtLocationCommand(),
            });

            this.logger.info(localize("StartingPackager", "Starting Packager"));
            // The packager will continue running while we debug the application, so we can"t
            // wait for this command to finish

            const spawnOptions = { env: reactEnv };

            const nodeModulesRoot: string = AppLauncher.getNodeModulesRootByProjectPath(
                this.projectPath,
            );

            let packagerSpawnResult;
            if (this.runOptions?.platform != "exponent") {
                packagerSpawnResult = new CommandExecutor(
                    nodeModulesRoot,
                    this.projectPath,
                    this.logger,
                ).spawnReactPackager(args, spawnOptions);
            } else {
                packagerSpawnResult = new CommandExecutor(
                    nodeModulesRoot,
                    this.projectPath,
                    this.logger,
                ).spawnExpoPackager(args, spawnOptions);
            }

            this.packagerProcess = packagerSpawnResult.spawnedProcess;

            packagerSpawnResult.outcome.catch(() => {}); // We ignore all outcome errors
        }

        await this.awaitStart();
        if (executedStartPackagerCmd) {
            this.logger.info(localize("PackagerStarted", "Packager started."));
            this.packagerStatus = PackagerStatus.PACKAGER_STARTED;
            void vscode.commands.executeCommand(
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
                            "React Native Packager running outside of VS Code. If you want to debug please use the 'Attach to packager' option.",
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
        void vscode.commands.executeCommand(
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
            } catch {
                // The attempt to prefetch the bundle failed. This may be because the bundle has
                // a different name that the one we guessed so we shouldn't treat this as fatal.
            }
        }
    }

    public async isRunning(): Promise<boolean> {
        const statusURL = `http://${this.getHost()}/status`;
        try {
            const body = await Request.request(statusURL);
            return body === "packager-status:running";
        } catch (error) {
            return false;
        }
    }

    public async forMessage(message: string, arg: Omit<MetroEventData, "data">): Promise<void> {
        await this.awaitStart();

        if (!this.packagerSocket || this.packagerSocket.CLOSED || this.packagerSocket.CLOSING) {
            const wsUrl = `ws://${this.getHost()}/events`;
            this.packagerSocket = new WebSocket(wsUrl, {
                origin: `http://${this.getHost()}/debugger-ui`, // random url because of packager bug
            });
        }

        return new Promise<void>((resolve, reject) => {
            const resolveHandler = async (handlerArg: string) => {
                const parsed: MetroEventData = JSON.parse(handlerArg);
                const value = parsed.data?.[0];

                if (
                    arg.level !== parsed.level ||
                    arg.type !== parsed.type ||
                    arg.mode !== parsed.mode ||
                    !value ||
                    typeof value !== "string"
                ) {
                    return;
                }

                if (value.includes(message)) {
                    assert(this.packagerSocket);
                    resolve();
                    this.packagerSocket.removeListener("message", resolveHandler);
                    this.packagerSocket.removeListener("error", reject);
                    this.packagerSocket.removeListener("close", reject);
                }
            };

            assert(this.packagerSocket);
            this.packagerSocket.addListener("error", reject);
            this.packagerSocket.addListener("close", reject);
            this.packagerSocket.addListener("message", resolveHandler);
        });
    }

    private async awaitStart(retryCount = 60, delay = 3000): Promise<void> {
        try {
            await PromiseUtil.retryAsync(
                () => this.isRunning(),
                running => running,
                retryCount,
                delay,
                localize("CouldNotStartPackager", "Could not start the packager."),
            );
        } catch (error) {
            this.setPackagerStopStateUI();
            throw error;
        }
    }

    private async findOpnPackage(ReactNativeVersion: string): Promise<string> {
        try {
            const OPN_PACKAGE_NAME =
                semver.gte(ReactNativeVersion, Packager.RN_VERSION_WITH_OPEN_PKG) ||
                ProjectVersionHelper.isCanaryVersion(ReactNativeVersion)
                    ? Packager.OPN_PACKAGE_NAME.new
                    : Packager.OPN_PACKAGE_NAME.old;

            const nodeModulesRoot: string = AppLauncher.getNodeModulesRootByProjectPath(
                this.projectPath,
            );

            const openModulePath = path.resolve(
                nodeModulesRoot,
                Packager.NODE_MODULES_FODLER_NAME,
                OPN_PACKAGE_NAME,
            );
            this.logger.info(
                localize(
                    "VerifyOpenModuleMainFileAndEntry",
                    "Need to check main file and entry point of open module, will setup and write new content if they're not existing. Path: {0}",
                    openModulePath,
                ),
            );

            const flatDependencyPackagePath = path.resolve(
                nodeModulesRoot,
                Packager.NODE_MODULES_FODLER_NAME,
                OPN_PACKAGE_NAME,
                Packager.OPN_PACKAGE_MAIN_FILENAME,
            );

            const nestedDependencyPackagePath = path.resolve(
                nodeModulesRoot,
                Packager.NODE_MODULES_FODLER_NAME,
                Packager.REACT_NATIVE_PACKAGE_NAME,
                Packager.NODE_MODULES_FODLER_NAME,
                OPN_PACKAGE_NAME,
                Packager.OPN_PACKAGE_MAIN_FILENAME,
            );

            const fsHelper = new FileSystem();

            // Attempt to find the 'opn' package directly under the project's node_modules folder (node4 +)
            // Else, attempt to find the package within the dependent node_modules of react-native package
            const possiblePaths = [flatDependencyPackagePath, nestedDependencyPackagePath];
            const paths = await Promise.all(
                possiblePaths.map(async fsPath => ((await fsHelper.exists(fsPath)) ? fsPath : "")),
            );
            const packagePath = paths.find(fsPath => !!fsPath);
            if (packagePath) {
                return packagePath;
            }
            throw ErrorHelper.getInternalError(InternalErrorCode.OpnPackagerLocationNotFound);
        } catch (err) {
            throw ErrorHelper.getInternalError(InternalErrorCode.OpnPackagerNotFound, err);
        }
    }

    private async monkeyPatchOpnForRNPackager(ReactNativeVersion: string): Promise<void> {
        // Finds the 'opn' or 'open' package
        const opnIndexFilePath = await this.findOpnPackage(ReactNativeVersion);
        const destnFilePath = opnIndexFilePath;
        // Read the package's "package.json"
        const opnPackage = new Package(path.resolve(path.dirname(destnFilePath)));

        const packageJson = await opnPackage.parsePackageInformation();
        const JS_INJECTOR_FILENAME =
            semver.gte(ReactNativeVersion, Packager.RN_VERSION_WITH_OPEN_PKG) ||
            ProjectVersionHelper.isCanaryVersion(ReactNativeVersion)
                ? Packager.JS_INJECTOR_FILENAME.new
                : Packager.JS_INJECTOR_FILENAME.old;
        const JS_INJECTOR_FILEPATH = path.resolve(
            Packager.JS_INJECTOR_DIRPATH,
            JS_INJECTOR_FILENAME,
        );
        if (packageJson.main !== JS_INJECTOR_FILENAME) {
            this.logger.info(
                localize(
                    "NoOpenMainFile",
                    "Cannot find main file in open module, executing setup...",
                ),
            );

            // Copy over the patched 'opn' main file
            this.logger.info(localize("CopyOpenMainFile", "Copy open-main.js to open module..."));
            await new FileSystem().copyFile(
                JS_INJECTOR_FILEPATH,
                path.resolve(path.dirname(destnFilePath), JS_INJECTOR_FILENAME),
            );

            // Write/over-write the "main" attribute with the new file
            this.logger.info(
                localize(
                    "AddOpenMainEntry",
                    "Add open-main.js entry to package.json 'main' field...",
                ),
            );
            return opnPackage.setMainFile(JS_INJECTOR_FILENAME);
        }
        this.logger.info(
            localize(
                "OpenMainEntryIsExisting",
                "Find open-main.js and entry in open module, skip setup...",
            ),
        );
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
        if (
            await new ExponentHelper(this.workspacePath, this.projectPath).isExpoManagedApp(false)
        ) {
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
        const atomScript = `node ${path.join(__dirname, "..", "..", "scripts", "atom")}`;

        //  shell-quote package incorrectly parses windows paths
        //  https://github.com/facebook/react-native/blob/master/local-cli/server/util/launchEditor.js#L83
        if (process.platform === "win32") {
            return atomScript.replace(/\\/g, "/");
        }

        return atomScript;
    }
}
