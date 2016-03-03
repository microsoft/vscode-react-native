// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as child_process from "child_process";
import Q = require("q");
import {NestedError} from "../nestedError";

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
    public exec(command: string, options: IExecOptions = {}): IExecResult {
        let outcome = Q.defer<Buffer>();

        let execProcess = child_process.exec(command, options, (error: Error, stdout: Buffer, stderr: Buffer) => {
            if (error) {
                outcome.reject(new NestedError(`Error while executing command ${command}`, error, stderr));
            } else {
                outcome.resolve(stdout);
            }
        });

        return { process: execProcess, outcome: outcome.promise };
    }

    public execToString(command: string, options: IExecOptions = {}): Q.Promise<string> {
        return this.exec(command).outcome.then(stdout => stdout.toString());
    }

    public spawnWithExitHandler(command: string, args?: string[], options: ISpawnOptions = {}): ISpawnResult {
        let outcome = Q.defer<void>();

        let spawnedProcess = child_process.spawn(command, args, options);
        spawnedProcess.once("error", (error: any) => {
            outcome.reject(error);
        });
        spawnedProcess.once("exit", (code: number) => {
            if (code === 0) {
                outcome.resolve(void 0);
            } else {
                outcome.reject(new Error(`Command ${command} failed with error code ${code}`));
            }
        });

        return {
              spawnedProcess: spawnedProcess,
              stdin: spawnedProcess.stdin,
              stdout: spawnedProcess.stdout,
              stderr: spawnedProcess.stderr,
              outcome: outcome.promise };
    }

    public spawn(command: string, args?: string[], options: ISpawnOptions = {}): ISpawnResult {
        let outcome = Q.defer<void>();
        let spawnedProcess = child_process.spawn(command, args, options);
        spawnedProcess.once("error", (error: any) => {
            outcome.reject(new NestedError(`Error while executing command ${command}`, error));
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
