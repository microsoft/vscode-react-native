// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as child_process from "child_process";
import Q = require("q");
import {ErrorHelper} from "../error/errorHelper";
import {InternalErrorCode} from "../error/internalErrorCode";

export interface IExecResult {
    process: child_process.ChildProcess;
    outcome: Q.Promise<Buffer>;
}

export interface ISpawnResult {
    spawnedProcess: child_process.ChildProcess;
    stdin: NodeJS.WritableStream;
    stdout: NodeJS.ReadableStream;
    stderr: NodeJS.ReadableStream;
    outcome: Q.Promise<void>;
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
    private childProcess: typeof child_process;

    constructor({childProcess = child_process} = {}) {
        this.childProcess = childProcess;
    }

    public exec(command: string, options: IExecOptions = {}): IExecResult {
        let outcome = Q.defer<Buffer>();

        let execProcess = this.childProcess.exec(command, options, (error: Error, stdout: Buffer, stderr: Buffer) => {
            if (error) {
                outcome.reject(ErrorHelper.getNestedError(error, InternalErrorCode.CommandFailed, command));
            } else {
                outcome.resolve(stdout);
            }
        });

        return { process: execProcess, outcome: outcome.promise };
    }

    public execToString(command: string, options: IExecOptions = {}): Q.Promise<string> {
        return this.exec(command, options).outcome.then(stdout => stdout.toString());
    }

    public spawnWaitUntilStarted(command: string, args: string[] = [], options: ISpawnOptions = {}): ISpawnResult {
        let outcome = Q.defer<void>();
        let spawnedProcess = this.childProcess.spawn(command, args, options);
        spawnedProcess.once("error", (error: any) => {
            outcome.reject(error);
        });

        Q.delay(ChildProcess.ERROR_TIMEOUT_MILLISECONDS).done(() => outcome.resolve(void 0));

        return {
              spawnedProcess: spawnedProcess,
              stdin: spawnedProcess.stdin,
              stdout: spawnedProcess.stdout,
              stderr: spawnedProcess.stderr,
              outcome: outcome.promise
       };
    }

    public spawnWaitUntilFinished(command: string, args: string[] = [], options: ISpawnOptions = {}): ISpawnResult {
        let outcome = Q.defer<void>();
        let commandWithArgs = command + " " + args.join(" ");

        let spawnedProcess = this.childProcess.spawn(command, args, options);
        spawnedProcess.once("error", (error: any) => {
            outcome.reject(error);
        });

        spawnedProcess.once("exit", (code: number) => {
            if (code === 0) {
                outcome.resolve(void 0);
            } else {
                outcome.reject(ErrorHelper.getInternalError(InternalErrorCode.CommandFailed, commandWithArgs, code));
            }
        });

        return {
              spawnedProcess: spawnedProcess,
              stdin: spawnedProcess.stdin,
              stdout: spawnedProcess.stdout,
              stderr: spawnedProcess.stderr,
              outcome: outcome.promise
       };
    }
}
