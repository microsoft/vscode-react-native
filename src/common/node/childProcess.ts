// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nodeChildProcess from "child_process";
import Q = require("q");
import {ErrorHelper} from "../error/errorHelper";
import {InternalErrorCode} from "../error/internalErrorCode";

// Uncomment the following lines to record all spawned processes executions
// import {Recorder} from "../../../test/resources/processExecution/recorder";
// Recorder.installGlobalRecorder();

export interface IExecResult {
    process: nodeChildProcess.ChildProcess;
    outcome: Q.Promise<string>;
}

export interface ISpawnResult {
    spawnedProcess: nodeChildProcess.ChildProcess;
    stdin: NodeJS.WritableStream;
    stdout: NodeJS.ReadableStream;
    stderr: NodeJS.ReadableStream;
    startup: Q.Promise<void>; // The app started succesfully
    outcome: Q.Promise<void>; // The app finished succesfully
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

    constructor({childProcess = nodeChildProcess} = {}) {
        this.childProcess = childProcess;
    }

    public exec(command: string, options: IExecOptions = {}): IExecResult {
        let outcome = Q.defer<string>();

        let execProcess = this.childProcess.exec(command, options, (error: Error, stdout: string, stderr: string) => {
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

    public spawn(command: string, args: string[] = [], options: ISpawnOptions = {}): ISpawnResult {
        const startup = Q.defer<void>();
        const outcome = Q.defer<void>();

        const spawnedProcess = this.childProcess.spawn(command, args, options);

        spawnedProcess.once("error", (error: any) => {
            startup.reject(error);
            outcome.reject(error);
        });

        Q.delay(ChildProcess.ERROR_TIMEOUT_MILLISECONDS).done(() =>
            startup.resolve(void 0));

        startup.promise.done(() => {}, () => {}); // Most callers don't use startup, and Q prints a warning if we don't attach any .done()

        spawnedProcess.once("exit", (code: number) => {
            if (code === 0) {
                outcome.resolve(void 0);
            } else {
                const commandWithArgs = command + " " + args.join(" ");
                outcome.reject(ErrorHelper.getInternalError(InternalErrorCode.CommandFailed, commandWithArgs, code));
            }
        });

        return {
              spawnedProcess: spawnedProcess,
              stdin: spawnedProcess.stdin,
              stdout: spawnedProcess.stdout,
              stderr: spawnedProcess.stderr,
              startup: startup.promise,
              outcome: outcome.promise,
       };
    }
}
