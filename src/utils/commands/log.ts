// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

import {OutputChannel} from "vscode";

enum LogLevel {
    None = 0,
    Error = 1,
    Warning = 2,
    Debug = 3,
    Trace = 4
}

export class Log {

    private static TAG: string = "[vscode-react-native]";

    public static appendStringToOutputChannel(message: string, outputChannel: OutputChannel) {
        outputChannel.appendLine(Log.formatStringForOutputChannel(message));
        outputChannel.show();
    }

    public static commandStarted(command: string, outputChannel?: OutputChannel) {
        Log.logMessage(`Executing command: ${command}`, outputChannel);
    }

    public static commandEnded(command: string, outputChannel?: OutputChannel) {
        Log.logMessage(`Finished executing: ${command}\n`, outputChannel);
    }

    public static commandFailed(command: string, error: any, outputChannel?: OutputChannel) {
        Log.logError(`Error while executing: ${command}`, error, outputChannel);
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
    public static logError(message: string, error?: any, outputChannel?: OutputChannel, logStack = true) {
        let errorMessageToLog = outputChannel ? `${message} ${Log.getErrorMessage(error)}` : `${Log.TAG} ${message} ${Log.getErrorMessage(error)}`;

        if (outputChannel) {
            Log.appendStringToOutputChannel(errorMessageToLog, outputChannel);
        } else {
            console.error(errorMessageToLog);
        }

        // We will not need the stack trace when logging to the OutputChannel in VS Code
        if (!outputChannel && logStack && error && (<Error>error).stack) {
            console.error(`Stack: ${(<Error>error).stack}`);
        }
    }

    /**
     * Gets the message of an error, if any. Otherwise it returns the empty string.
     */
    public static getErrorMessage(e: any): string {
        return e && e.message || e && e.error && e.error.message || e && e.toString() || "";
    }

    /**
     * Logs a message to the console.
     */
    public static logMessage(message: string, outputChannel?: OutputChannel) {
        let messageToLog = outputChannel ? message : `${Log.TAG} ${message}`;

        if (outputChannel) {
            Log.appendStringToOutputChannel(messageToLog, outputChannel);
        } else {
            console.log(messageToLog);
        }

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

    private static formatStringForOutputChannel(message: string) {
        return "######### " + message + " ##########";
    }
}