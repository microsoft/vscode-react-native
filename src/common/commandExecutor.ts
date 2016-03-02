// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {ChildProcess} from "child_process";
import {Log} from "./log";
import {Node} from "./node/node";
import {ISpawnResult} from "./node/childProcess";
import {OutputChannel} from "vscode";
import {NestedError} from "./nestedError";

interface EnvironmentOptions {
    REACT_DEBUGGER?: string;
}

interface Options {
    env?: EnvironmentOptions;
}

export class CommandExecutor {
    private currentWorkingDirectory: string;

    constructor(currentWorkingDirectory?: string) {
        this.currentWorkingDirectory = currentWorkingDirectory;
    }

    public execute(command: string, options: Options = {}): Q.Promise<void> {
        Log.commandStarted(command);
        return new Node.ChildProcess().execToString(command, { cwd: this.currentWorkingDirectory, env: options.env })
            .then(stdout => {
                Log.logMessage(stdout);
                Log.commandEnded(command);
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
     * {outputChannel} - optional object of type vscode.OutputChannel where logs need to be printed
     */
    public spawn(command: string, args: string[], options: Options = {}, outputChannel?: OutputChannel): ChildProcess {
        return this.spawnChildProcess(command, args, options, outputChannel).spawnedProcess;
    }

    /**
     * Spawns a child process with the params passed
     * This method waits until the spawned process finishes execution
     * {command} - The command to be invoked in the child process
     * {args} - Arguments to be passed to the command
     * {options} - additional options with which the child process needs to be spawned
     * {outputChannel} - optional object of type vscode.OutputChannel where logs need to be printed
     */
    public spawnAndWaitForCompletion(command: string, args: string[], options: Options = {}, outputChannel?: OutputChannel): Q.Promise<void> {
        return this.spawnChildProcess(command, args, options, outputChannel).outcome;
    }

    /**
     * Spawns the React Native packager in a child process.
     */
    public spawnReactPackager(args?: string[], options: Options = {}, outputChannel?: OutputChannel): Q.Promise<ChildProcess> {
        let deferred = Q.defer<ChildProcess>();
        let command = this.getReactCommandName();
        let runArguments = ["start"];

        if (args) {
            runArguments = runArguments.concat(args);
        }

        let spawnOptions = Object.assign({}, { cwd: this.currentWorkingDirectory }, options);

        let result = new Node.ChildProcess().spawn(command, runArguments, spawnOptions);
        result.spawnedProcess.once("error", (error: any) => {
            deferred.reject(new NestedError(`Error while executing React Native Packager`, error));
        });

        result.stderr.on("data", (data: Buffer) => {
            if (outputChannel) {
                outputChannel.append(data.toString());
            } else {
                process.stderr.write(data);
            }
        });

        result.stdout.on("data", (data: Buffer) => {
            if (outputChannel) {
                outputChannel.append(data.toString());
            } else {
                process.stdout.write(data);
            }
        });

        // TODO #83 - PROMISE: We need to consume result.outcome here
        Q.delay(300).done(() => deferred.resolve(result.spawnedProcess));
        return deferred.promise;
    }

    /**
     * Kills the React Native packager in a child process.
     */
    public killReactPackager(packagerProcess: ChildProcess, outputChannel?: OutputChannel): Q.Promise<void> {
        Log.logMessage("Stopping Packager", outputChannel);

        if (packagerProcess) {
            /* To reliably kill the child process on all versions of Windows,
             * please use taskkill to end the packager process */
            if (process.platform === "win32") {
                return new Node.ChildProcess().exec("taskkill /pid " + packagerProcess.pid + " /T /F").outcome.then(() => {
                    Log.logMessage("Packager stopped", outputChannel);
                });
            } else {
                packagerProcess.kill();
                Log.logMessage("Packager stopped", outputChannel);
                return Q.resolve<void>(void 0);
            }
        } else {
            Log.logMessage("Packager not found", outputChannel);
            return Q.resolve<void>(void 0);
        }
    }



    /**
     * Executes a react native command and waits for its completion.
     */
    public spawnAndWaitReactCommand(command: string, args?: string[], options: Options = {}, outputChannel?: OutputChannel): Q.Promise<void> {
        return this.spawnChildReactCommandProcess(command, args, options, outputChannel).outcome;
    }

    public spawnChildReactCommandProcess(command: string, args?: string[], options: Options = {}, outputChannel?: OutputChannel): ISpawnResult {
        let runArguments = [command];
        if (args) {
            runArguments = runArguments.concat(args);
        }
        return this.spawnChildProcess(this.getReactCommandName(), runArguments, options, outputChannel);
    }

    public spawnChildProcess(command: string, args: string[], options: Options = {}, outputChannel?: OutputChannel): ISpawnResult {
        let spawnOptions = Object.assign({}, { cwd: this.currentWorkingDirectory }, options);
        let commandWithArgs = command + " " + args.join(" ");

        Log.commandStarted(commandWithArgs, outputChannel);
        let result = new Node.ChildProcess().spawnWithExitHandler(command, args, spawnOptions);

        result.stderr.on("data", (data: Buffer) => {
            if (outputChannel) {
                outputChannel.append(data.toString());
            } else {
                process.stderr.write(data);
            }
        });

        result.stdout.on("data", (data: Buffer) => {
            if (outputChannel) {
                outputChannel.append(data.toString());
            } else {
                process.stdout.write(data);
            }
        });

        result.outcome = result.outcome.then(
            () =>
                Log.commandEnded(commandWithArgs, outputChannel),
            reason =>
                this.generateRejectionForCommand(command, reason));

        return result;
    }

    /**
     * Resolves the dev machine, desktop platform.
     */
    private getReactCommandName() {
        let platform = process.platform;
        switch (platform) {
            case "darwin":
                return "react-native";
            case "win32":
            default:
                return "react-native.cmd";
        }
    }

    private generateRejectionForCommand(command: string, reason: any): Q.Promise<void> {
        return Q.reject<void>(new NestedError(`Error while executing: ${command}`, reason));
    }
}
