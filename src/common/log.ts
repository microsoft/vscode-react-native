// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

import {CommandStatus} from "./commandExecutor";
import {LogHelper, LogChannelType, LogLevel} from "./logHelper";
import {OutputChannelLogFormatter} from "./outputChannelLogFormatter";
import {StreamLogFormatter} from "./streamLogFormatter";
import {OutputChannel} from "vscode";

export class Log {

    private static TAG: string = "[vscode-react-native]";

    public static logCommandStatus(command: string, status: CommandStatus, targetLogChannel?: any) {
        console.assert(status >= CommandStatus.Start && status <= CommandStatus.End, "Unsupported Command Status");

        let statusMessage = Log.getCommandStatusString(command, status);
        Log.log(statusMessage, targetLogChannel || console);
    }

    /**
     * Logs an internal message for when someone is debugging the extension itself.
     * Customers aren't interested in these messages, so we normally shouldn't show
     * them to them.
     */
    public static logInternalMessage(logLevel: LogLevel, message: string, targetChannel?: any) {
        if (LogHelper.getExtensionLogLevel() >= logLevel) {
            this.logMessage(`[Internal-${logLevel}] ${message}`, targetChannel);
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
        let errorMessagePostfix =  error ? `: ${LogHelper.getErrorMessage(error)}` : "";
        let errorMessageToLog = errorMessagePrefix + message + errorMessagePostfix;

        if (outputChannel) {
            Log.logToOutputChannel(errorMessageToLog, outputChannel);
        } else {
            console.error(errorMessageToLog);
        }

        // We will not need the stack trace when logging to the OutputChannel in VS Code
        if (!outputChannel && logStack && error && (<Error>error).stack) {
            console.error(`Stack: ${(<Error>error).stack}`);
        }
    }

    /**
     * Logs a message to the console or the OutputChannel
     */
    public static logMessage(message: string, targetLogChannel?: any, formatMessage: boolean = true) {
        Log.log(message, targetLogChannel || console, formatMessage);
    }

    /**
     * Logs a message to the console.
     */
    public static logToConsole(message: string, formatMessage: boolean = true) {
        console.log(formatMessage ?
            StreamLogFormatter.getFormattedMessage(message) :
            message);
    }

    public static logToOutputChannel(message: string, outputChannel: OutputChannel, formatMessage: boolean = true) {
        outputChannel.appendLine(formatMessage ?
            OutputChannelLogFormatter.getFormattedMessage(message) :
            message);
        outputChannel.show();
    }

    public static stdout(message: string, targetChannel?: any) {
        Log.log(message, targetChannel, false);
    }

    public static stderr(message: string, targetChannel?: any) {
        Log.log(message, targetChannel, false);
    }

    private static getCommandStatusString(command: string, status: CommandStatus) {
        console.assert(status >= CommandStatus.Start && status <= CommandStatus.End, "Unsupported Command Status");

        switch (status) {
            case CommandStatus.Start:
                return `Executing command: ${command}`;

            case CommandStatus.End:
                return `Finished executing: ${command}`;

            default:
                throw new Error("Unsupported command status");
        }
    }

    private static log(message: string, targetLogChannel: any, formatMessage: boolean = true) {
        switch (LogHelper.getLogChannelType(targetLogChannel)) {
            case LogChannelType.OutputChannel:
                Log.logToOutputChannel(message, targetLogChannel, formatMessage);
                break;

            case LogChannelType.WritableStream:
                targetLogChannel.write(formatMessage ?
                    StreamLogFormatter.getFormattedMessage(message) :
                    message);
                break;

            case LogChannelType.Console:
            default:
                Log.logToConsole(message, formatMessage);
                break;
        }
    }
}