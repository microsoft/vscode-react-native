// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */
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
    public static getErrorMessage(e: Error): string {
        return e && e.message || e && e.toString() || "";
    }
}