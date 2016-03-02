import * as vscode from "vscode";

import {ISpawnResult} from "../../common/node/childProcess";
import {CommandExecutor} from "../../common/commandExecutor";
import {Log} from "../../common/log";
import {SettingsHelper} from "../settingsHelper";

/* This class will print the LogCat messages to an Output Channel. The configuration for logcat can be cutomized in
   the .vscode/settings.json file by defining a setting named reactNativeTools.logcat.arguments. The setting accepts
   parameters as:
      1. an array: ["*:S", "ReactNative:V", "ReactNativeJS:V"]
      2. a string: "*:S ReactNative:V ReactNativeJS:V"
   Type `adb logcat --help` to see the parameters and usage of logcat
*/
export class LogCatMonitor implements vscode.Disposable {
    private static DEFAULT_PARAMETERS = ["*:S", "ReactNative:V", "ReactNativeJS:V"];
    private static ARGUMENTS_SETTING_NAME = "reactNativeTools.logcat.arguments"

    private commandExecutor: CommandExecutor;

    private outputChannel = vscode.window.createOutputChannel("LogCat");

    private logCatSpawn: ISpawnResult;

    constructor({ commandExecutor = new CommandExecutor() } = {}) {
        this.commandExecutor = commandExecutor;
    }

    public setup(): Q.Promise<void> {
        return this.logCatArguments().then(logCatArguments => {
            const adbParameters = ["logcat"].concat(logCatArguments);
            // TODO: After the refactor of ChildProcess and CommandExecutor is complete, update this so we won't print the logcat
            // messages for the first 1 second, or something similar to ignore the "existing" logcat messages
            this.logCatSpawn = new CommandExecutor().spawnChildProcess("adb", adbParameters, null, this.outputChannel);
            return this.logCatSpawn.outcome;
        })
    }

    public logCatArguments(): Q.Promise<string[]> {
        // We use the setting if it's defined, or the defaults if it fails
        return SettingsHelper.read(LogCatMonitor.ARGUMENTS_SETTING_NAME).catch(error =>
            LogCatMonitor.DEFAULT_PARAMETERS).then(logCatArguments =>
                Array.isArray(logCatArguments)
                ? logCatArguments.map(arg => "" + arg) // Convert array to string[]
                : ("" + logCatArguments).split(" ")); // Parse string and split into string[]
    }

    public dispose(): void {
        if (this.logCatSpawn) {
            this.logCatSpawn.spawnedProcess.kill();
            this.logCatSpawn = null;
        }
    }
}
