// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

import {OutputChannel} from "vscode";

export class Log {

    private static TAG: string = "[vscode-react-native]";
    private static formatStringForOutputChannel(message: string) {
        return  "######### " + message + " ##########";
    }

    public static appendStringToOutputChannel(message: string, outputChannel: OutputChannel) {
        outputChannel.appendLine(Log.formatStringForOutputChannel(message));
        outputChannel.show();
    }

    public static commandStarted(command: string, outputChannel?: OutputChannel) {
        let message = `Executing command: ${command}`;

        if (outputChannel) {
            Log.appendStringToOutputChannel(message, outputChannel);
        } else {
            Log.logMessage(message);
        }
    }

    public static commandEnded(command: string, outputChannel?: OutputChannel) {
        let message = `Finished executing: ${command}\n`;

        if (outputChannel) {
            Log.appendStringToOutputChannel(message, outputChannel);
        } else {
            Log.logMessage(message);
        }
    }

    public static commandFailed(command: string, error: any, outputChannel?: OutputChannel) {
        let message = `Error while executing: ${command}`;

        if (outputChannel) {
            Log.appendStringToOutputChannel(message, outputChannel);
        } else {
            Log.logError(message, error);
        }
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