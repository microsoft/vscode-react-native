// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

import {OutputChannel} from "vscode";

export enum LogLevel {
    None = 0,
    Error = 1,
    Warning = 2,
    Info = 3,
    Debug = 4,
    Trace = 5
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

    /**
     * Logs an internal message for when someone is debugging the extension itself.
     * Customers aren't interested in these messages, so we normally shouldn't show
     * them to them.
     */
    public static logInternalMessage(logLevel: LogLevel, message: string) {
        if (this.extensionLogLevel() >= logLevel) {
            this.logMessage(`[Internal-${logLevel}] ${message}`);
        }
    }

    /**
     * Logs a warning message to the console.
     */
    public static logWarning(message: string, error?: any, outputChannel?: OutputChannel, logStack = true) {
        // TODO #83: Refactor this code and create a better implementation
        this.logError(`WARNING: ${message}`, error, outputChannel, logStack);
    }

    /**
     * Logs an error message to the console.
     */
    public static logError(message: string, error?: any, outputChannel?: OutputChannel, logStack = true) {
        let errorMessagePrefix = outputChannel ? "" : `${Log.TAG} `;
        let errorMessagePostfix =  error ? `: ${Log.getErrorMessage(error)}` : "";
        let errorMessageToLog = errorMessagePrefix + message + errorMessagePostfix;

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

    /**
     * Gets the message of a non null error, if any. Otherwise it returns the empty string.
     */
    private static getErrorMessage(e: any): string {
        let message = e.message || e.error && e.error.message;
        if (!message) {
            try {
                return JSON.stringify(e);
            } catch (exception) {
                // This is a best-effort feature, so we ignore any exceptions. If possible we'll print the error stringified.
                // If not, we'll just use one of the fallbacks
                return e.error || e.toString() || "";
            }
        } else {
            return message;
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

    private static formatStringForOutputChannel(message: string) {
        return "######### " + message + " ##########";
    }
}