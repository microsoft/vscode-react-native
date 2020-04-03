// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as fs from "fs";

import {IRunOptions} from "./launchArgs";
import {Packager} from "../common/packager";
import {PackagerStatusIndicator, PackagerStatus} from "./packagerStatusIndicator";
import {SettingsHelper} from "./settingsHelper";
import {OutputChannelLogger} from "./log/OutputChannelLogger";
import * as nls from "vscode-nls";
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

    constructor(protected runOptions: IRunOptions, platformDeps: MobilePlatformDeps = {}) {
        this.platformName = this.runOptions.platform;
        this.projectPath = this.runOptions.projectRoot;
        this.packager = platformDeps.packager || new Packager(this.runOptions.workspaceRoot, this.projectPath, SettingsHelper.getPackagerPort(this.runOptions.workspaceRoot), new PackagerStatusIndicator());
        this.packager.setRunOptions(runOptions);
        this.logger = OutputChannelLogger.getChannel(localize("ReactNativeRunPlatform", "React Native: Run {0}", this.platformName), true);
        this.logger.clear();
        this.runArguments = this.getRunArguments();
    }

    public runApp(): Q.Promise<void> {
        this.logger.info(localize("ConnectedToPackager", "Connected to packager. You can now open your app in the simulator."));
        return Q.resolve<void>(void 0);
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        this.logger.info(localize("DebuggerReadyEnableRemoteDebuggingInApp", "Debugger ready. Enable remote debugging in app."));
        return Q.resolve<void>(void 0);
    }

    public disableJSDebuggingMode(): Q.Promise<void> {
        this.logger.info(localize("DebuggerReadyDisableRemoteDebuggingInApp", "Debugger ready. Disable remote debugging in app."));
        return Q.resolve<void>(void 0);
    }

    public beforeStartPackager(): Q.Promise<void> {
        return Q.resolve<void>(void 0);
    }

    public startPackager(): Q.Promise<void> {
        this.logger.info(localize("StartingReactNativePackager", "Starting React Native Packager."));
        return this.packager.isRunning()
        .then((running) => {
            if (running) {
                if (this.packager.getPackagerStatus() !== PackagerStatus.PACKAGER_STARTED) {
                    return this.packager.stop();
                }

                this.logger.info(localize("AttachingToRunningReactNativePackager", "Attaching to running React Native packager"));
            }
            return void 0;
        })
        .then(() => {
            return this.packager.start();
        });
    }

    public prewarmBundleCache(): Q.Promise<void> {
        // generalMobilePlatform should do nothing here. Method should be overriden by children for specific behavior.
        return Q.resolve<void>(void 0);
    }

    public static getOptFromRunArgs(runArguments: any[], optName: string, binary: boolean = false): any {
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
        let modifyEnv = processEnv;

        if (envFile) {
            let buffer = fs.readFileSync(envFile, "utf8");

            // Strip BOM
            if (buffer && buffer[0] === "\uFEFF") {
                buffer = buffer.substr(1);
            }

            buffer.split("\n").forEach((line: string) => {
                const r = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
                if (r !== null) {
                    const key = r[1];
                    if (!modifyEnv[key]) {	// .env variables never overwrite existing variables
                        let value = r[2] || "";
                        if (value.length > 0 && value.charAt(0) === "\"" && value.charAt(value.length - 1) === "\"") {
                            value = value.replace(/\\n/gm, "\n");
                        }
                        modifyEnv[key] = value.replace(/(^['"]|['"]$)/g, "");
                    }
                }
            });
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
}
