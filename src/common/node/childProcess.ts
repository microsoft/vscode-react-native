// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nodeChildProcess from "child_process";
import { ErrorHelper } from "../error/errorHelper";
import { InternalErrorCode } from "../error/internalErrorCode";
import { notNullOrUndefined } from "../utils";
import { kill } from "process";

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
        let outcome: Promise<string>;
        let process: nodeChildProcess.ChildProcess;
        return new Promise<IExecResult>(resolveRes => {
            outcome = new Promise<string>((resolve, reject) => {
                process = this.childProcess.exec(
                    command,
                    options,
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    (error: Error, stdout: string, stderr: string) => {
                        if (error) {
                            reject(
                                ErrorHelper.getNestedError(
                                    error,
                                    InternalErrorCode.CommandFailed,
                                    command,
                                ),
                            );
                        } else {
                            resolve(stdout);
                        }
                    },
                );
            });
            resolveRes({ process: process, outcome: outcome });
        });
    }

    public execToString(command: string, options: IExecOptions = {}): Promise<string> {
        return this.exec(command, options).then(result =>
            result.outcome.then(stdout => stdout.toString()),
        );
    }

    public execFileSync(
        command: string,
        args: string[] = [],
        options: IExecOptions = {},
    ): Buffer | string {
        return this.childProcess.execFileSync(command, args, options);
    }

    public spawn(
        command: string,
        args: string[] = [],
        options: ISpawnOptions = {},
        showStdOutputsOnError: boolean = false,
    ): ISpawnResult {
        const spawnedProcess = this.childProcess.spawn(command, args, options);
        let outcome: Promise<void> = new Promise((resolve, reject) => {
            spawnedProcess.once("error", (error: any) => {
                reject(error);
            });

            const stderrChunks: string[] = [];
            const stdoutChunks: string[] = [];

            spawnedProcess.stderr.on("data", data => {
                stderrChunks.push(data.toString());
            });

            spawnedProcess.stdout.on("data", data => {
                stdoutChunks.push(data.toString());
            });

            spawnedProcess.once("exit", (code: number) => {
                if (code === 0) {
                    resolve();
                } else {
                    const commandWithArgs = command + " " + args.join(" ");
                    if (showStdOutputsOnError) {
                        let details = "";
                        if (stdoutChunks.length > 0) {
                            details = details.concat(
                                `\n\tSTDOUT: ${stdoutChunks[stdoutChunks.length - 1]}`,
                            );
                        }
                        if (stderrChunks.length > 0) {
                            details = details.concat(`\n\tSTDERR: ${stderrChunks.join("\n\t")}`);
                        }
                        if (details === "") {
                            details = "STDOUT and STDERR are empty!";
                        }
                        reject(
                            ErrorHelper.getInternalError(
                                InternalErrorCode.CommandFailedWithDetails,
                                commandWithArgs,
                                details,
                            ),
                        );
                    } else {
                        reject(
                            ErrorHelper.getInternalError(
                                InternalErrorCode.CommandFailed,
                                commandWithArgs,
                                code,
                            ),
                        );
                    }
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

    // Kills any orphaned Instruments processes belonging to the user.
    //
    // In some cases, we've seen interactions between Instruments and the iOS
    // simulator that cause hung instruments and DTServiceHub processes. If
    // enough instances pile up, the host machine eventually becomes
    // unresponsive. Until the underlying issue is resolved, manually kill any
    // orphaned instances (where the parent process has died and PPID is 1)
    // before launching another instruments run.
    public async killOrphanedInstrumentsProcesses() {
        const result = await this.execToString("ps -e -o user,ppid,pid,comm");
        if (result) {
            result
                .split("\n")
                .filter(notNullOrUndefined)
                .map(a => /^(\S+)\s+1\s+(\d+)\s+(.+)$/.exec(a))
                .filter(notNullOrUndefined)
                .filter(m => m[1] === process.env.USER)
                .filter(
                    m =>
                        m[3] && ["/instruments", "/DTServiceHub"].some(name => m[3].endsWith(name)),
                )
                .forEach(m => {
                    const pid = m[2];
                    console.debug(`Killing orphaned Instruments process: ${pid}`);
                    kill(parseInt(pid, 10), "SIGKILL");
                });
        }
    }
}
