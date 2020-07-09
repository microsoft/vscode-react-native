// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nodeChildProcess from "child_process";
import { ErrorHelper } from "../error/errorHelper";
import { InternalErrorCode } from "../error/internalErrorCode";
import { resolve } from "dns";

// Uncomment the following lines to record all spawned processes executions
// import {Recorder} from "../../../test/resources/processExecution/recorder";
// Recorder.installGlobalRecorder();

export interface IExecResult {
    process: nodeChildProcess.ChildProcess;
    outcome: Promise<string>;
}

export interface ISpawnResult {
    spawnedProcess: nodeChildProcess.ChildProcess;
    stdin: NodeJS.WritableStream;
    stdout: NodeJS.ReadableStream;
    stderr: NodeJS.ReadableStream;
    outcome: Promise<void>;
}

interface IExecOptions {
    cwd?: string;
    stdio?: any;
    env?: any;
    encoding?: string;
    timeout?: number;
    maxBuffer?: number;
    killSignal?: string;
}

interface ISpawnOptions {
    cwd?: string;
    stdio?: any;
    env?: any;
    detached?: boolean;
}

export class ChildProcess {
    public static ERROR_TIMEOUT_MILLISECONDS = 300;
    private childProcess: typeof nodeChildProcess;

    constructor({ childProcess = nodeChildProcess } = {}) {
        this.childProcess = childProcess;
    }

    public exec(command: string, options: IExecOptions = {}): Promise<IExecResult> {
        return new Promise<IExecResult>((resolveRes) => {
            const outcome: Promise<string> = new Promise<string>((resolve, reject) => {
                const process = this.childProcess.exec(command, options, (error: Error, stdout: string, stderr: string) => {
                        if (error) {
                            reject(ErrorHelper.getNestedError(error, InternalErrorCode.CommandFailed, command));
                        } else {
                            resolve(stdout);
                        }
                    });
                    resolveRes({process: process, outcome: outcome});
                });
        })

    }

    public execToString(command: string, options: IExecOptions = {}): Promise<string> {
        return this.exec(command, options).then(result => result.outcome.then(stdout => stdout.toString()));
    }

    public execFileSync(command: string, args: string[] = [], options: IExecOptions = {}): Buffer | string {
        return this.childProcess.execFileSync(command, args, options);
    }

    public spawn(command: string, args: string[] = [], options: ISpawnOptions = {}): ISpawnResult {
        const spawnedProcess = this.childProcess.spawn(command, args, options);
        let outcome: Promise<void> = new Promise((resolve, reject) => {
            spawnedProcess.once("error", (error: any) => {
                reject(error);
            });

            spawnedProcess.once("exit", (code: number) => {
                if (code === 0) {
                    resolve();
                } else {
                    const commandWithArgs = command + " " + args.join(" ");
                    reject(ErrorHelper.getInternalError(InternalErrorCode.CommandFailed, commandWithArgs, code));
                }
            });
        });
        return {
            spawnedProcess: spawnedProcess,
            stdin: spawnedProcess.stdin,
            stdout: spawnedProcess.stdout,
            stderr: spawnedProcess.stderr,
            outcome: outcome,
     };

    }
}
