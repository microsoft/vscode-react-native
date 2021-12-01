// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";

import * as nls from "vscode-nls";
import { ISpawnResult } from "../../common/node/childProcess";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ExecutionsFilterBeforeTimestamp } from "../../common/executionsLimiter";
import { AdbHelper } from "./adb";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

/* This class will print the LogCat messages to an Output Channel. The configuration for logcat can be cutomized in
   the .vscode/launch.json file by defining a setting named logCatArguments for the configuration being used. The
   setting accepts values as:
      1. an array: ["*:S", "ReactNative:V", "ReactNativeJS:V"]
      2. a string: "*:S ReactNative:V ReactNativeJS:V"
   Type `adb logcat --help` to see the parameters and usage of logcat
*/
export class LogCatMonitor implements vscode.Disposable {
    private static DEFAULT_PARAMETERS = ["*:S", "ReactNative:V", "ReactNativeJS:V"];

    private _logger: OutputChannelLogger;

    private _userProvidedLogCatArguments: any; // This is user input, we don't know what's here

    private _logCatSpawn: ISpawnResult | null;
    private adbHelper: AdbHelper;
    public deviceId: string;

    constructor(deviceId: string, adbHelper: AdbHelper, userProvidedLogCatArguments?: string[]) {
        this.deviceId = deviceId;
        this._userProvidedLogCatArguments = userProvidedLogCatArguments;

        this._logger = OutputChannelLogger.getChannel(`LogCat - ${deviceId}`);
        this.adbHelper = adbHelper;
    }

    public async start(): Promise<void> {
        const logCatArguments = this.getLogCatArguments();
        const adbParameters = ["-s", this.deviceId, "logcat"].concat(logCatArguments);
        this._logger.debug(
            `Monitoring LogCat for device ${this.deviceId} with arguments: ${logCatArguments}`,
        );

        this._logCatSpawn = this.adbHelper.startLogCat(adbParameters);

        /* LogCat has a buffer and prints old messages when first called. To ignore them,
            we won't print messages for the first 0.5 seconds */
        const filter = new ExecutionsFilterBeforeTimestamp(/* delayInSeconds*/ 0.5);
        this._logCatSpawn.stderr.on("data", (data: Buffer) => {
            filter.execute(() => this._logger.info(data.toString()));
        });

        this._logCatSpawn.stdout.on("data", (data: Buffer) => {
            filter.execute(() => this._logger.info(data.toString()));
        });

        try {
            await this._logCatSpawn.outcome;
            this._logger.info(
                localize(
                    "LogCatMonitoringStoppedBecauseTheProcessExited",
                    "LogCat monitoring stopped because the process exited.",
                ),
            );
        } catch (error) {
            if (!this._logCatSpawn) {
                // We stopped log cat ourselves
                this._logger.info(
                    localize(
                        "LogCatMonitoringStoppedBecauseTheDebuggingSessionFinished",
                        "LogCat monitoring stopped because the debugging session finished",
                    ),
                );
            } else {
                throw error; // Unknown error. Pass it up the promise chain
            }
        } finally {
            this._logCatSpawn = null;
        }
    }

    public dispose(): void {
        if (this._logCatSpawn) {
            const logCatSpawn = this._logCatSpawn;
            this._logCatSpawn = null;
            logCatSpawn.spawnedProcess.kill();
        }

        OutputChannelLogger.disposeChannel(this._logger.channelName);
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
