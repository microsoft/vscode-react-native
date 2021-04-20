// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as cp from "child_process";
import { ILogger } from "../extension/log/LogHelper";
import { NullLogger } from "../extension/log/NullLogger";
import { ProjectVersionHelper } from "../common/projectVersionHelper";
import { ISpawnResult } from "./node/childProcess";
import { HostPlatform, HostPlatformId } from "./hostPlatform";
import { ErrorHelper } from "./error/errorHelper";
import { InternalErrorCode } from "./error/internalErrorCode";
import * as nls from "vscode-nls";
import { Node } from "./node/node";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export enum CommandVerbosity {
    OUTPUT,
    SILENT,
    PROGRESS,
}

interface EnvironmentOptions {
    REACT_DEBUGGER?: string;
}

interface Options {
    env?: EnvironmentOptions;
    verbosity?: CommandVerbosity;
    cwd?: string;
}

export enum CommandStatus {
    Start = 0,
    End = 1,
}

export class CommandExecutor {
    public static ReactNativeCommand: string | null;
    private childProcess = new Node.ChildProcess();

    constructor(
        private nodeModulesRoot: string,
        private currentWorkingDirectory: string = process.cwd(),
        private logger: ILogger = new NullLogger(),
    ) {}

    public execute(command: string, options: Options = {}): Promise<void> {
        this.logger.debug(CommandExecutor.getCommandStatusString(command, CommandStatus.Start));
        return this.childProcess
            .execToString(command, { cwd: this.currentWorkingDirectory, env: options.env })
            .then(
                stdout => {
                    this.logger.info(stdout);
                    this.logger.debug(
                        CommandExecutor.getCommandStatusString(command, CommandStatus.End),
                    );
                },
                (reason: Error) => this.generateRejectionForCommand(command, reason),
            );
    }

    /**
     * Spawns a child process with the params passed
     * This method waits until the spawned process finishes execution
     * {command} - The command to be invoked in the child process
     * {args} - Arguments to be passed to the command
     * {options} - additional options with which the child process needs to be spawned
     */
    public spawn(command: string, args: string[], options: Options = {}): Promise<any> {
        return this.spawnChildProcess(command, args, options).outcome;
    }

    /**
     * Spawns the React Native packager in a child process.
     */
    public spawnReactPackager(args: string[], options: Options = {}): ISpawnResult {
        return this.spawnReactCommand("start", args, options);
    }

    public getReactNativeVersion(): Promise<string> {
        return ProjectVersionHelper.getReactNativeVersions(this.currentWorkingDirectory).then(
            versions => versions.reactNativeVersion,
        );
    }

    /**
     * Kills the React Native packager in a child process.
     */
    public killReactPackager(packagerProcess?: cp.ChildProcess): Promise<void> {
        if (packagerProcess) {
            return new Promise(resolve => {
                if (HostPlatform.getPlatformId() === HostPlatformId.WINDOWS) {
                    return resolve(
                        this.childProcess
                            .exec("taskkill /pid " + packagerProcess.pid + " /T /F")
                            .then(res => res.outcome),
                    );
                } else {
                    packagerProcess.kill();
                    return resolve(void 0);
                }
            }).then(() => {
                this.logger.info(localize("PackagerStopped", "Packager stopped"));
            });
        } else {
            this.logger.warning(localize("PackagerNotFound", "Packager not found"));
            return Promise.resolve();
        }
    }

    /**
     * Executes a react native command and waits for its completion.
     */
    public spawnReactCommand(
        command: string,
        args: string[] = [],
        options: Options = {},
    ): ISpawnResult {
        const reactCommand = HostPlatform.getNpmCliCommand(this.selectReactNativeCLI());
        return this.spawnChildProcess(reactCommand, [command, ...args], options);
    }

    /**
     * Spawns a child process with the params passed
     * This method has logic to do while the command is executing
     * {command} - The command to be invoked in the child process
     * {args} - Arguments to be passed to the command
     * {options} - additional options with which the child process needs to be spawned
     */
    public spawnWithProgress(
        command: string,
        args: string[],
        options: Options = { verbosity: CommandVerbosity.OUTPUT },
    ): Promise<void> {
        const spawnOptions = Object.assign({}, { cwd: this.currentWorkingDirectory }, options);
        const commandWithArgs = command + " " + args.join(" ");
        const timeBetweenDots = 1500;
        let lastDotTime = 0;

        const printDot = () => {
            const now = Date.now();
            if (now - lastDotTime > timeBetweenDots) {
                lastDotTime = now;
                this.logger.logStream(".", process.stdout);
            }
        };

        if (options.verbosity === CommandVerbosity.OUTPUT) {
            this.logger.debug(
                CommandExecutor.getCommandStatusString(commandWithArgs, CommandStatus.Start),
            );
        }

        const result = this.childProcess.spawn(command, args, spawnOptions);

        result.stdout.on("data", (data: Buffer) => {
            if (options.verbosity === CommandVerbosity.OUTPUT) {
                this.logger.logStream(data, process.stdout);
            } else if (options.verbosity === CommandVerbosity.PROGRESS) {
                printDot();
            }
        });

        result.stderr.on("data", (data: Buffer) => {
            if (options.verbosity === CommandVerbosity.OUTPUT) {
                this.logger.logStream(data, process.stderr);
            } else if (options.verbosity === CommandVerbosity.PROGRESS) {
                printDot();
            }
        });

        return new Promise((resolve, reject) => {
            result.outcome = result.outcome.then(
                () => {
                    if (options.verbosity === CommandVerbosity.OUTPUT) {
                        this.logger.debug(
                            CommandExecutor.getCommandStatusString(
                                commandWithArgs,
                                CommandStatus.End,
                            ),
                        );
                    }
                    this.logger.logStream("\n", process.stdout);
                    resolve();
                },
                reason => {
                    reject(reason);
                    return this.generateRejectionForCommand(commandWithArgs, reason);
                },
            );
        });
    }

    public selectReactNativeCLI(): string {
        return (
            CommandExecutor.ReactNativeCommand ||
            path.resolve(this.nodeModulesRoot, "node_modules", ".bin", "react-native")
        );
    }

    private spawnChildProcess(
        command: string,
        args: string[],
        options: Options = {},
    ): ISpawnResult {
        const spawnOptions = Object.assign({}, { cwd: this.currentWorkingDirectory }, options);
        const commandWithArgs = command + " " + args.join(" ");

        this.logger.debug(
            CommandExecutor.getCommandStatusString(commandWithArgs, CommandStatus.Start),
        );
        const result = this.childProcess.spawn(command, args, spawnOptions);

        result.stderr.on("data", (data: Buffer) => {
            this.logger.logStream(data, process.stderr);
        });

        result.stdout.on("data", (data: Buffer) => {
            this.logger.logStream(data, process.stdout);
        });

        result.outcome = result.outcome.then(
            () =>
                this.logger.debug(
                    CommandExecutor.getCommandStatusString(commandWithArgs, CommandStatus.End),
                ),
            reason => this.generateRejectionForCommand(commandWithArgs, reason),
        );
        return result;
    }

    private generateRejectionForCommand(command: string, reason: any): Promise<void> {
        return Promise.reject<void>(
            ErrorHelper.getNestedError(reason, InternalErrorCode.CommandFailed, command),
        );
    }

    private static getCommandStatusString(command: string, status: CommandStatus) {
        switch (status) {
            case CommandStatus.Start:
                return `Executing command: ${command}`;
            case CommandStatus.End:
                return `Finished executing: ${command}`;
            default:
                throw ErrorHelper.getInternalError(InternalErrorCode.UnsupportedCommandStatus);
        }
    }
}
