// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {Node} from "../node/node";
import {Log} from "./log";

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
            reason => Log.commandFailed(command, reason));
    }

    public spawn(command: string, args: string[], options: Options = {}): Q.Promise<void> {
        let spawnOptions = Object.assign({}, { cwd: this.currentWorkingDirectory }, options);
        let commandWithArgs = command + " " + args.join(" ");

        Log.commandStarted(commandWithArgs);
        let result = new Node.ChildProcess().spawn(command, args, spawnOptions);

        result.stderr.on("data", (data: Buffer) => {
            process.stdout.write(data);
        });

        result.stdout.on("data", (data: Buffer) => {
            process.stdout.write(data);
        });

        return result.outcome.then(() => {
            Log.commandEnded(commandWithArgs);
        },
            reason => Log.commandFailed(commandWithArgs, reason));
    }

}
