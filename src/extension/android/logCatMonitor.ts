// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as vscode from "vscode";

import {ChildProcess, ISpawnResult} from "../../common/node/childProcess";
import {OutputChannelLogger} from "../outputChannelLogger";
import {ExecutionsFilterBeforeTimestamp} from "../../common/executionsLimiter";

/* This class will print the LogCat messages to an Output Channel. The configuration for logcat can be cutomized in
   the .vscode/launch.json file by defining a setting named logCatArguments for the configuration being used. The
   setting accepts values as:
      1. an array: ["*:S", "ReactNative:V", "ReactNativeJS:V"]
      2. a string: "*:S ReactNative:V ReactNativeJS:V"
   Type `adb logcat --help` to see the parameters and usage of logcat
*/
export class LogCatMonitor implements vscode.Disposable {
    private static DEFAULT_PARAMETERS = ["*:S", "ReactNative:V", "ReactNativeJS:V"];

    private _childProcess: ChildProcess;
    private _logger = new OutputChannelLogger(vscode.window.createOutputChannel("LogCat"));

    private _deviceId: string;
    private _userProvidedLogCatArguments: any; // This is user input, we don't know what's here

    private _logCatSpawn: ISpawnResult;

    constructor(deviceId: string, userProvidedLogCatArguments: string, { childProcess = new ChildProcess() } = {}) {
        this._deviceId = deviceId;
        this._userProvidedLogCatArguments = userProvidedLogCatArguments;
        this._childProcess = childProcess;
    }

    public start(): Q.Promise<void> {
        const logCatArguments = this.getLogCatArguments();
        const adbParameters = ["-s", this._deviceId, "logcat"].concat(logCatArguments);
        this._logger.logMessage(`Monitoring LogCat for device ${this._deviceId} with arguments: ${logCatArguments}`);

        this._logCatSpawn = new ChildProcess().spawnWaitUntilFinished("adb", adbParameters);

        /* LogCat has a buffer and prints old messages when first called. To ignore them,
            we won't print messages for the first 0.5 seconds */
        const filter = new ExecutionsFilterBeforeTimestamp(/*delayInSeconds*/ 0.5);
        this._logCatSpawn.stderr.on("data", (data: Buffer) => {
            filter.execute(() => this._logger.logMessage(data.toString(), /*formatMessage*/ false));
        });

        this._logCatSpawn.stdout.on("data", (data: Buffer) => {
            filter.execute(() => this._logger.logMessage(data.toString(), /*formatMessage*/ false));
        });

        return this._logCatSpawn.outcome.then(
            () =>
                this._logger.logMessage("LogCat monitoring stopped because the process exited."),
            reason => {
                if (!this._logCatSpawn) { // We stopped log cat ourselves
                    this._logger.logMessage("LogCat monitoring stopped because the debugging session finished");
                } else {
                    return Q.reject<void>(reason); // Unkown error. Pass it up the promise chain
                }
            }).finally(() =>
                this._logCatSpawn = null);
    }

    public dispose(): void {
        if (this._logCatSpawn) {
            const logCatSpawn = this._logCatSpawn;
            this._logCatSpawn = null;
            logCatSpawn.spawnedProcess.kill();
        }
    }

    private getLogCatArguments(): string[] {
        // We use the setting if it's defined, or the defaults if it's not
        return this.isNullOrUndefined(this._userProvidedLogCatArguments) // "" is a valid value, so we can't just if () this
            ? LogCatMonitor.DEFAULT_PARAMETERS
            : ("" + this._userProvidedLogCatArguments).split(" "); // Parse string and split into string[]
    }

    private isNullOrUndefined(value: any): boolean {
        return typeof value === "undefined" || value === null;
    }
}
