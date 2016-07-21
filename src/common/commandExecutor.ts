// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {ChildProcess} from "child_process";
import {Log} from "./log/log";
import {Node} from "./node/node";
import {ISpawnResult} from "./node/childProcess";
import {HostPlatform, HostPlatformId} from "../common/hostPlatform";
import {ErrorHelper} from "./error/errorHelper";
import {InternalErrorCode} from "./error/internalErrorCode";

interface EnvironmentOptions {
    REACT_DEBUGGER?: string;
}

interface Options {
    env?: EnvironmentOptions;
    silent?: boolean;
}

export enum CommandStatus {
    Start = 0,
    End = 1
}

export class CommandExecutor {
    private static ReactNativeCommand = "react-native";
    private static ReactNativeVersionCommand = "-v";
    private currentWorkingDirectory: string;
    private childProcess = new Node.ChildProcess();

    constructor(currentWorkingDirectory?: string) {
        this.currentWorkingDirectory = currentWorkingDirectory || process.cwd();
    }

    public execute(command: string, options: Options = {}): Q.Promise<void> {
        if (!options.silent) {
            Log.logCommandStatus(command, CommandStatus.Start);
        }
        return this.childProcess.execToString(command, { cwd: this.currentWorkingDirectory, env: options.env })
            .then(stdout => {
                if (!options.silent) {
                    Log.logMessage(stdout);
                    Log.logCommandStatus(command, CommandStatus.End);
                }
            },
            (reason: Error) =>
                this.generateRejectionForCommand(command, reason));
    }

    /**
     * Spawns a child process with the params passed
     * This method waits until the spawned process finishes execution
     * {command} - The command to be invoked in the child process
     * {args} - Arguments to be passed to the command
     * {options} - additional options with which the child process needs to be spawned
     */
    public spawn(command: string, args: string[], options: Options = {}): Q.Promise<any> {
        return this.spawnChildProcess(command, args, options).outcome;
    }

    /**
     * Spawns the React Native packager in a child process.
     */
    public spawnReactPackager(args: string[], options: Options = {}): ISpawnResult {
        return this.spawnReactCommand("start", args, options);
    }

    /**
     * Uses the `react-native -v` command to get the version used on the project.
     * Returns null if the workspace is not a react native project
     */
    public getReactNativeVersion(): Q.Promise<string> {
        let deferred = Q.defer<string>();
        const reactCommand = HostPlatform.getNpmCliCommand(CommandExecutor.ReactNativeCommand);
        let output = "";

        const result = this.childProcess.spawn(reactCommand,
            [CommandExecutor.ReactNativeVersionCommand],
            { cwd: this.currentWorkingDirectory });

        result.stdout.on("data", (data: Buffer) => {
            output += data.toString();
        });

        result.stdout.on("end", () => {
            const match = output.match(/react-native: ([\d\.]+)/);
            deferred.resolve(match && match[1]);
        });

        return deferred.promise;
    }

    /**
     * Kills the React Native packager in a child process.
     */
    public killReactPackager(packagerProcess: ChildProcess): Q.Promise<void> {
        if (packagerProcess) {
            return Q({}).then(() => {
                if (HostPlatform.getPlatformId() === HostPlatformId.WINDOWS) {
                    return this.childProcess.exec("taskkill /pid " + packagerProcess.pid + " /T /F").outcome;
                } else {
                    packagerProcess.kill();
                }
            }).then(() => {
                Log.logMessage("Packager stopped");
            });

        } else {
            Log.logMessage("Packager not found");
            return Q.resolve<void>(void 0);
        }
    }

    /**
     * Executes a react native command and waits for its completion.
     */
    public spawnReactCommand(command: string, args?: string[], options: Options = {}): ISpawnResult {
        const reactCommand = HostPlatform.getNpmCliCommand(CommandExecutor.ReactNativeCommand);
        return this.spawnChildProcess(reactCommand, this.combineArguments(command, args), options);
    }

    private spawnChildProcess(command: string, args: string[], options: Options = {}): ISpawnResult {
        const spawnOptions = Object.assign({}, { cwd: this.currentWorkingDirectory }, options);
        const commandWithArgs = command + " " + args.join(" ");

        Log.logCommandStatus(commandWithArgs, CommandStatus.Start);
        const result = this.childProcess.spawn(command, args, spawnOptions);

        result.stderr.on("data", (data: Buffer) => {
            Log.logStreamData(data, process.stderr);
        });

        result.stdout.on("data", (data: Buffer) => {
           Log.logStreamData(data, process.stdout);
        });

        result.outcome = result.outcome.then(
            () =>
                Log.logCommandStatus(commandWithArgs, CommandStatus.End),
            reason =>
                this.generateRejectionForCommand(commandWithArgs, reason));
        return result;
    }

    private generateRejectionForCommand(command: string, reason: any): Q.Promise<void> {
        return Q.reject<void>(ErrorHelper.getNestedError(reason, InternalErrorCode.CommandFailed, command));
    }

    private combineArguments(firstArgument: string, otherArguments: string[] = []) {
        return [firstArgument].concat(otherArguments);
    }
}
