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
}

export enum CommandStatus {
    Start = 0,
    End = 1
}

export class CommandExecutor {
    private static ReactNativeCommand = "react-native";
    private currentWorkingDirectory: string;

    constructor(currentWorkingDirectory?: string) {
        this.currentWorkingDirectory = currentWorkingDirectory || process.cwd();
    }

    public execute(command: string, options: Options = {}): Q.Promise<void> {
        Log.logCommandStatus(command, CommandStatus.Start);
        return new Node.ChildProcess().execToString(command, { cwd: this.currentWorkingDirectory, env: options.env })
            .then(stdout => {
                Log.logMessage(stdout);
                Log.logCommandStatus(command, CommandStatus.End);
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
        return this.spawnChildProcess(command, args, true, options).outcome;
    }

    /**
     * Spawns the React Native packager in a child process.
     */
    public spawnReactPackager(args?: string[], options: Options = {}): Q.Promise<ISpawnResult> {
        let command = HostPlatform.getNpmCliCommand(CommandExecutor.ReactNativeCommand);
        let runArguments = ["start"];

        if (args) {
            runArguments = runArguments.concat(args);
        }

        let spawnOptions = Object.assign({}, { cwd: this.currentWorkingDirectory }, options);
        let result = this.spawnChildProcess(command, runArguments, false, spawnOptions);
        return Q.resolve(result);
    }

    /**
     * Kills the React Native packager in a child process.
     */
    public killReactPackager(packagerProcess: ChildProcess): Q.Promise<void> {
        Log.logMessage("Stopping Packager");

        if (packagerProcess) {
            return Q({}).then(() => {
                if (HostPlatform.getPlatformId() === HostPlatformId.WINDOWS) {
                    return new Node.ChildProcess().exec("taskkill /pid " + packagerProcess.pid + " /T /F").outcome;
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
    public spawnReactCommand(command: string, args?: string[], waitForExit: boolean = true, options: Options = {}): ISpawnResult {
        return this.spawnChildReactCommandProcess(command, args, waitForExit, options);
    }

    public spawnChildReactCommandProcess(command: string, args?: string[], waitForExit: boolean = true, options: Options = {}): ISpawnResult {
        let runArguments = [command];
        if (args) {
            runArguments = runArguments.concat(args);
        }

        let reactCommand = HostPlatform.getNpmCliCommand(CommandExecutor.ReactNativeCommand);
        return this.spawnChildProcess(reactCommand, runArguments, waitForExit, options);
    }

    private spawnChildProcess(command: string, args: string[], waitForExit: boolean = true, options: Options = {}): ISpawnResult {
        let spawnInfo = { command: command, args: args, waitForExit: waitForExit };
        let spawnOptions = Object.assign({}, { cwd: this.currentWorkingDirectory }, options);
        let commandWithArgs = command + " " + args.join(" ");

        Log.logCommandStatus(commandWithArgs, CommandStatus.Start);
        let result = new Node.ChildProcess().spawn(spawnInfo, spawnOptions);

        result.stderr.on("data", (data: Buffer) => {
            Log.logStreamData(data, process.stderr);
        });

        result.stdout.on("data", (data: Buffer) => {
           Log.logStreamData(data, process.stdout);
        });

        result.outcome = result.outcome.then(
            () => {
                if (waitForExit) {
                    Log.logCommandStatus(commandWithArgs, CommandStatus.End);
                } else {
                    Q.delay(300).done(() => {
                        return result;
                    });
                }
            },
            reason =>
                this.generateRejectionForCommand(commandWithArgs, reason));
        return result;
    }

    private generateRejectionForCommand(command: string, reason: any): Q.Promise<void> {
        return Q.reject<void>(ErrorHelper.getNestedError(reason, InternalErrorCode.CommandFailed, command));
    }
}
