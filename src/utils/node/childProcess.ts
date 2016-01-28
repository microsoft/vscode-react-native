import * as child_process from "child_process";
import Q = require("q");

export interface IExecResult {
    process: child_process.ChildProcess;
    outcome: Q.Promise<Buffer>;
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

interface ISpawnResult {
    stdin: any;
    stdout: any;
    stderr: any;
    outcome: Q.Promise<number>;
}

export class ChildProcess {
    public exec(command: string, options: IExecOptions = {}): IExecResult {
        let outcome = Q.defer<Buffer>();

        let execProcess = child_process.exec(command, options, (error: Error, stdout: Buffer, stderr: Buffer) => {
            if (error) {
                outcome.reject({ error: error, stderr: stderr});
            } else {
                outcome.resolve(stdout);
            }
        });

        return { process: execProcess, outcome: outcome.promise };
    }

    public execToString(command: string, options: IExecOptions = {}): Q.Promise<string> {
        return this.exec(command).outcome.then(stdout => stdout.toString());
    }

    public spawn(command: string, args?: string[], options: ISpawnOptions = {}): ISpawnResult {
        let outcome = Q.defer<number>();

        let spawnedProcess = child_process.spawn(command, args, options);
        spawnedProcess.once("error", (error: any) => {
            outcome.reject({ error: error });
        });
        spawnedProcess.once("close", (code: number) => {
            if (code === 0) {
                outcome.resolve(code);
            }
        });

        return { stdin: spawnedProcess.stdin,
             stdout: spawnedProcess.stdout,
              stderr: spawnedProcess.stderr,
               outcome: outcome.promise };
    }
}
