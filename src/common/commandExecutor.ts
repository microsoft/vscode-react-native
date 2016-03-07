// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {ChildProcess} from "child_process";
import {Log} from "./log/log";
import {Node} from "./node/node";
import {ISpawnResult} from "./node/childProcess";
import {HostPlatformResolver} from "../common/hostPlatform";
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
        this.currentWorkingDirectory = currentWorkingDirectory;
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
     * Spawns a child process with the params passed and returns promise of the spawned ChildProcess
     * This method does not wait for the spawned process to finish execution
     * {command} - The command to be invoked in the child process
     * {args} - Arguments to be passed to the command
     * {options} - additional options with which the child process needs to be spawned
     */
    public spawn(command: string, args: string[], options: Options = {}): ChildProcess {
        return this.spawnChildProcess(command, args, options).spawnedProcess;
    }

    /**
     * Spawns a child process with the params passed
     * This method waits until the spawned process finishes execution
     * {command} - The command to be invoked in the child process
     * {args} - Arguments to be passed to the command
     * {options} - additional options with which the child process needs to be spawned
     */
    public spawnAndWaitForCompletion(command: string, args: string[], options: Options = {}): Q.Promise<void> {
        return this.spawnChildProcess(command, args, options).outcome;
    }

    /**
     * Spawns the React Native packager in a child process.
     */
    public spawnReactPackager(args?: string[], options: Options = {}): Q.Promise<ChildProcess> {
        let deferred = Q.defer<ChildProcess>();
        let command = HostPlatformResolver.getHostPlatform().getCommand(CommandExecutor.ReactNativeCommand);
        let runArguments = ["start"];

        if (args) {
            runArguments = runArguments.concat(args);
        }

        let spawnOptions = Object.assign({}, { cwd: this.currentWorkingDirectory }, options);

        let result = new Node.ChildProcess().spawn(command, runArguments, spawnOptions);
        result.spawnedProcess.once("error", (error: any) => {
            deferred.reject(ErrorHelper.getNestedError(error, InternalErrorCode.PackagerStartFailed));
        });

        result.stderr.on("data", (data: Buffer) => {
            Log.logMessage(data.toString(), /*formatMessage*/false);
        });

        result.stdout.on("data", (data: Buffer) => {
            Log.logMessage(data.toString(), /*formatMessage*/false);
        });

        // TODO #83 - PROMISE: We need to consume result.outcome here
        Q.delay(300).done(() => deferred.resolve(result.spawnedProcess));
        return deferred.promise;
    }

    /**
     * Kills the React Native packager in a child process.
     */
    public killReactPackager(packagerProcess: ChildProcess): Q.Promise<void> {
        Log.logMessage("Stopping Packager");
        if (packagerProcess) {
            return HostPlatformResolver.getHostPlatform().killProcess(packagerProcess)
                .then(() => {
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
    public spawnAndWaitReactCommand(command: string, args?: string[], options: Options = {}): Q.Promise<void> {
        return this.spawnChildReactCommandProcess(command, args, options).outcome;
    }

    public spawnChildReactCommandProcess(command: string, args?: string[], options: Options = {}): ISpawnResult {
        let runArguments = [command];
        if (args) {
            runArguments = runArguments.concat(args);
        }

        let reactCommand = HostPlatformResolver.getHostPlatform().getCommand(CommandExecutor.ReactNativeCommand);
        return this.spawnChildProcess(reactCommand, runArguments, options);
    }

    private spawnChildProcess(command: string, args: string[], options: Options = {}): ISpawnResult {
        let spawnOptions = Object.assign({}, { cwd: this.currentWorkingDirectory }, options);
        let commandWithArgs = command + " " + args.join(" ");

        Log.logCommandStatus(commandWithArgs, CommandStatus.Start);
        let result = new Node.ChildProcess().spawnWithExitHandler(command, args, spawnOptions);

        result.stderr.on("data", (data: Buffer) => {
            Log.logMessage(data.toString(), /*formatMessage*/ false);
        });

        result.stdout.on("data", (data: Buffer) => {
            Log.logMessage(data.toString(), /*formatMessage*/ false);
        });

        result.outcome = result.outcome.then(
            () =>
                Log.logCommandStatus(commandWithArgs, CommandStatus.End),
            reason =>
                this.generateRejectionForCommand(command, reason));

        return result;
    }

    private generateRejectionForCommand(command: string, reason: any): Q.Promise<void> {
        return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.CommandFailed, command, reason));
    }
}
