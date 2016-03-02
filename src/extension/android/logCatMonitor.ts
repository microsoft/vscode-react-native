// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";

import {ISpawnResult} from "../../common/node/childProcess";
import {CommandExecutor} from "../../common/commandExecutor";

/* This class will print the LogCat messages to an Output Channel. The configuration for logcat can be cutomized in
   the .vscode/launch.json file by defining a setting named logCatArguments for the configuration being used. The
   setting accepts values as:
      1. an array: ["*:S", "ReactNative:V", "ReactNativeJS:V"]
      2. a string: "*:S ReactNative:V ReactNativeJS:V"
   Type `adb logcat --help` to see the parameters and usage of logcat
*/
export class LogCatMonitor implements vscode.Disposable {
    private static DEFAULT_PARAMETERS = ["*:S", "ReactNative:V", "ReactNativeJS:V"];

    private _commandExecutor: CommandExecutor;

    private _outputChannel = vscode.window.createOutputChannel("LogCat");

    private _logCatSpawn: ISpawnResult;

    private _userProvidedLogCatArguments: any; // This is user input, we don't know what's here

    constructor(userProvidedLogCatArguments: string, { commandExecutor = new CommandExecutor() } = {}) {
        this._userProvidedLogCatArguments = userProvidedLogCatArguments;
        this._commandExecutor = commandExecutor;
    }

    public start(): Q.Promise<void> {
        const adbParameters = ["logcat"].concat(this.logCatArguments());
        // TODO: After the refactor of ChildProcess and CommandExecutor is complete, update this so we won't print the logcat
        // messages for the first 1 second, or something similar to ignore the "existing" logcat messages
        this._logCatSpawn = new CommandExecutor().spawnChildProcess("adb", adbParameters, null, this._outputChannel);
        return this._logCatSpawn.outcome.finally(() =>
            this._logCatSpawn = null);
    }

    public logCatArguments(): string[] {
        // We use the setting if it's defined, or the defaults if it's not
        return this.isNullOrUndefined(this._userProvidedLogCatArguments) // "" is a valid value, so we can't just if () this
            ? LogCatMonitor.DEFAULT_PARAMETERS
            : ("" + this._userProvidedLogCatArguments).split(" "); // Parse string and split into string[]
    }

    public dispose(): void {
        if (this._logCatSpawn) {
            this._logCatSpawn.spawnedProcess.kill();
            this._logCatSpawn = null;
        }
    }

    public get outputChannel(): vscode.OutputChannel {
        return this._outputChannel;
    }

    private isNullOrUndefined(value: any): boolean {
        return typeof value === "undefined" || value === null;
    }
}
