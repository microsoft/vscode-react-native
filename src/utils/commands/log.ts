// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

enum LogLevel {
    None = 0,
    Error = 1,
    Warning = 2,
    Debug = 3,
    Trace = 4
}

export class Log {

    private static TAG: string = "[vscode-react-native]";

    public static commandStarted(command: string) {
        Log.logMessage(`Executing command: ${command}`);
    }

    public static commandEnded(command: string) {
        Log.logMessage(`Finished executing: ${command}\n`);
    }

    public static commandFailed(command: string, error: any) {
        Log.logError(`Error while executing: ${command}`, error);
    }

    /**
     * Logs a message to the console.
     */
    public static logMessage(message: string) {
        console.log(`${Log.TAG} ${message}`);
    }

    private static extensionLogLevel(): LogLevel {
        // TODO: Improve this logic. Make it case insensitive, etc...
        let logLevelIndex = process.argv.indexOf("--extensionLogLevel");
        if (logLevelIndex >= 0 && logLevelIndex + 1 < process.argv.length) {
            let logLevelText = process.argv[logLevelIndex + 1];
            return (<any>LogLevel)[logLevelText];
        } else {
            return LogLevel.None; // Default extension log level
        }
    }

    private static shouldLogInternal(): boolean {
        return this.extensionLogLevel() > LogLevel.None;
    }
    /**
     * Logs an internal message for when someone is debugging the extension itself.
     * Customers aren't interested in these messages, so we normally shouldn't show
     * them to them.
     */
    public static logInternalMessage(message: string) {
        if (this.shouldLogInternal()) {
            console.log(`${Log.TAG}[Internal] ${message}`);
        }
    }

    /**
     * Logs an error message to the console.
     */
    public static logError(message: string, error?: any, logStack = true) {
        console.error(`${Log.TAG} ${message} ${Log.getErrorMessage(error)}`);
        if (logStack && error && (<Error>error).stack) {
            console.error(`Stack: ${(<Error>error).stack}`);
        }
    }

    /**
     * Gets the message of an error, if any. Otherwise it returns the empty string.
     */
    public static getErrorMessage(e: any): string {
        return e && e.message || e && e.error && e.error.message || e && e.toString() || "";
    }
}