// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ChildProcess} from "child_process";
import {Log} from "./log";
import {Node} from "../node/node";
import {OutputChannel} from "vscode";
import * as Q from "q";

interface EnvironmentOptions {
    REACT_DEBUGGER?: string;
}

interface Options {
    env?: EnvironmentOptions;
}

export class CommandExecutor {
    private currentWorkingDirectory: string;

    constructor(currentWorkingDirectory: string) {
        this.currentWorkingDirectory = currentWorkingDirectory;
    }

    public execute(command: string, options: Options = {}): Q.Promise<void> {
        Log.commandStarted(command);
        return new Node.ChildProcess().execToString(command, { cwd: this.currentWorkingDirectory, env: options.env })
            .then(stdout => {
                Log.logMessage(stdout);
                Log.commandEnded(command);
            },
            reason => Log.commandFailed(command, reason));
    }

    public spawn(command: string, args: string[], options: Options = {}, outputChannel?: OutputChannel): Q.Promise<ChildProcess> {
        let spawnOptions = Object.assign({}, { cwd: this.currentWorkingDirectory }, options);
        let commandWithArgs = command + " " + args.join(" ");

        if (outputChannel) {
            outputChannel.appendLine("######### Executing: " + commandWithArgs + " ##########");
            outputChannel.show();
        }

        Log.commandStarted(commandWithArgs);
        let result = new Node.ChildProcess().spawn(command, args, spawnOptions);

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

        result.outcome.then(() => {
            if (outputChannel) {
                outputChannel.appendLine("######### Finished executing: " + commandWithArgs + " ##########");
            } else {
                Log.commandEnded(commandWithArgs);
            }
        },
        (reason) => {
            if (outputChannel) {
                outputChannel.appendLine("######### Failed executing: " + commandWithArgs + " ##########");
            } else {
                Log.commandFailed(commandWithArgs, reason)
            }
        });

        return Q.resolve(result.spawnedProcess);
    }

}
