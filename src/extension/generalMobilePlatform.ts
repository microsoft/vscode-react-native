// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import { IRunOptions } from "./launchArgs";
import { Packager } from "../common/packager";
import { PackagerStatusIndicator, PackagerStatus } from "./packagerStatusIndicator";
import { SettingsHelper } from "./settingsHelper";
import { OutputChannelLogger } from "./log/OutputChannelLogger";
import * as nls from "vscode-nls";
import { isBoolean } from "util";
import { IVirtualDevice } from "./VirtualDeviceManager";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export interface MobilePlatformDeps {
    packager?: Packager;
}

export type TargetType = "device" | "simulator";

export class GeneralMobilePlatform {
    protected projectPath: string;
    protected platformName: string;
    protected packager: Packager;
    protected logger: OutputChannelLogger;

    protected static deviceString: TargetType = "device";
    protected static simulatorString: TargetType = "simulator";
    protected static NO_PACKAGER_VERSION = "0.42.0";

    public runArguments: string[];

    constructor(
        protected runOptions: IRunOptions,
        platformDeps: MobilePlatformDeps = {},
        protected nodeModulesRoot: string,
    ) {
        this.platformName = this.runOptions.platform;
        this.projectPath = this.runOptions.projectRoot;
        this.packager =
            platformDeps.packager ||
            new Packager(
                this.runOptions.workspaceRoot,
                this.projectPath,
                SettingsHelper.getPackagerPort(this.runOptions.workspaceRoot),
                new PackagerStatusIndicator(this.projectPath),
            );
        this.packager.setRunOptions(runOptions);
        this.logger = OutputChannelLogger.getChannel(
            localize("ReactNativeRunPlatform", "React Native: Run {0}", this.platformName),
            true,
        );
        this.logger.clear();
        this.runArguments = this.getRunArguments();
    }

    public dispose(): void {
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public resolveVirtualDevice(target: string): Promise<IVirtualDevice | null> {
        return Promise.resolve(null);
    }

    public runApp(): Promise<void> {
        this.logger.info(
            localize(
                "ConnectedToPackager",
                "Connected to packager. You can now open your app in the simulator.",
            ),
        );
        return Promise.resolve();
    }

    public enableJSDebuggingMode(): Promise<void> {
        this.logger.info(
            localize(
                "DebuggerReadyEnableRemoteDebuggingInApp",
                "Debugger ready. Enable remote debugging in app.",
            ),
        );
        return Promise.resolve();
    }

    public disableJSDebuggingMode(): Promise<void> {
        this.logger.info(
            localize(
                "DebuggerReadyDisableRemoteDebuggingInApp",
                "Debugger ready. Disable remote debugging in app.",
            ),
        );
        return Promise.resolve();
    }

    public beforeStartPackager(): Promise<void> {
        return Promise.resolve();
    }

    public startPackager(): Promise<void> {
        this.logger.info(
            localize("StartingReactNativePackager", "Starting React Native Packager."),
        );
        return this.packager
            .isRunning()
            .then(running => {
                if (running) {
                    if (this.packager.getPackagerStatus() !== PackagerStatus.PACKAGER_STARTED) {
                        return this.packager.stop();
                    }

                    this.logger.info(
                        localize(
                            "AttachingToRunningReactNativePackager",
                            "Attaching to running React Native packager",
                        ),
                    );
                }
                return void 0;
            })
            .then(() => {
                return this.packager.start();
            });
    }

    public prewarmBundleCache(): Promise<void> {
        // generalMobilePlatform should do nothing here. Method should be overriden by children for specific behavior.
        return Promise.resolve();
    }

    public static removeRunArgument(runArguments: any[], optName: string, binary: boolean): void {
        const optIdx = runArguments.indexOf(optName);
        if (optIdx > -1) {
            if (binary) {
                runArguments.splice(optIdx, 1);
            } else {
                runArguments.splice(optIdx, 2);
            }
        }
    }

    public static setRunArgument(
        runArguments: any[],
        optName: string,
        value: string | boolean,
    ): void {
        const isBinary = isBoolean(value);
        const optIdx = runArguments.indexOf(optName);
        if (optIdx > -1) {
            if (isBinary && !value) {
                GeneralMobilePlatform.removeRunArgument(runArguments, optName, true);
            }
            if (!isBinary) {
                runArguments[optIdx + 1] = value;
            }
        } else {
            if (isBinary && value) {
                runArguments.push(optName);
            }
            if (!isBinary) {
                runArguments.push(optName);
                runArguments.push(value);
            }
        }
    }

    public static getOptFromRunArgs(
        runArguments: any[],
        optName: string,
        binary: boolean = false,
    ): any {
        if (runArguments.length > 0) {
            const optIdx = runArguments.indexOf(optName);
            let result: any = undefined;

            if (optIdx > -1) {
                result = binary ? true : runArguments[optIdx + 1];
            } else {
                for (let i = 0; i < runArguments.length; i++) {
                    const arg = runArguments[i];
                    if (arg.indexOf(optName) > -1) {
                        if (binary) {
                            result = true;
                        } else {
                            const tokens = arg.split("=");
                            if (tokens.length > 1) {
                                result = tokens[1].trim();
                            } else {
                                result = undefined;
                            }
                        }
                    }
                }
            }

            // Binary parameters can either exists (e.g. be true) or be absent. You can not pass false binary parameter.
            if (binary) {
                if (result === undefined) {
                    return undefined;
                } else {
                    return true;
                }
            }

            if (result) {
                try {
                    return JSON.parse(result);
                } catch (err) {
                    // simple string value, return as is
                    return result;
                }
            }
        }

        return undefined;
    }

    public getRunArguments(): string[] {
        throw new Error("Not yet implemented: GeneralMobilePlatform.getRunArguments");
    }

    public static getEnvArgument(processEnv: any, env?: any, envFile?: string): any {
        let modifyEnv = Object.assign({}, processEnv);

        if (envFile) {
            // .env variables never overwrite existing variables
            const argsFromEnvFile = this.readEnvFile(envFile);
            if (argsFromEnvFile != null) {
                for (let key in argsFromEnvFile) {
                    if (!modifyEnv[key] && argsFromEnvFile.hasOwnProperty(key)) {
                        modifyEnv[key] = argsFromEnvFile[key];
                    }
                }
            }
        }

        if (env) {
            // launch config env vars overwrite .env vars
            for (let key in env) {
                if (env.hasOwnProperty(key)) {
                    modifyEnv[key] = env[key];
                }
            }
        }
        return modifyEnv;
    }

    private static readEnvFile(filePath: string): any {
        if (fs.existsSync(filePath)) {
            let buffer = fs.readFileSync(filePath, "utf8");
            let result = {};

            // Strip BOM
            if (buffer && buffer[0] === "\uFEFF") {
                buffer = buffer.substr(1);
            }

            buffer.split("\n").forEach((line: string) => {
                const r = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
                if (r !== null) {
                    const key = r[1];
                    let value = r[2] || "";
                    if (
                        value.length > 0 &&
                        value.charAt(0) === '"' &&
                        value.charAt(value.length - 1) === '"'
                    ) {
                        value = value.replace(/\\n/gm, "\n");
                    }
                    result[key] = value.replace(/(^['"]|['"]$)/g, "");
                }
            });

            return result;
        } else {
            return null;
        }
    }
}
