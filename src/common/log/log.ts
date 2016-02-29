// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

import {CommandStatus} from "../commandExecutor";
import {LogHelper, LogChannelType, LogLevel} from "./logHelper";
import {OutputChannelLogFormatter} from "./outputChannelLogFormatter";
import {StreamLogFormatter} from "./streamLogFormatter";
import {OutputChannel} from "vscode";

export class Log {
    /**
     * Logs a message.
     */
    public static logMessage(message: string, targetLogChannel: any = null, formatMessage: boolean = true) {
        Log.log(message, targetLogChannel || console, formatMessage);
    }

    /**
     * Logs an error message.
     */
    public static logError(error?: any, outputChannel?: OutputChannel, logStack = true) {
        let errorMessageToLog = LogHelper.getErrorString(error, outputChannel || console);

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
     * Logs a warning message.
     */
    public static logWarning(error?: any, outputChannel: OutputChannel = null, logStack = true) {
        this.logError(error, outputChannel, logStack);
    }

    /**
     * Logs an internal message for when someone is debugging the extension itself.
     * Customers aren't interested in these messages, so we normally shouldn't show
     * them to them.
     */
    public static logInternalMessage(logLevel: LogLevel, message: string, targetChannel: any = null) {
        if (LogHelper.logLevel >= logLevel) {
            this.logMessage(`[Internal-${logLevel}] ${message}`, targetChannel);
        }
    }

    /**
     * Logs the status (Start/End) of a command.
     */
    public static logCommandStatus(command: string, status: CommandStatus, targetLogChannel: any = null) {
        console.assert(status >= CommandStatus.Start && status <= CommandStatus.End, "Unsupported Command Status");

        let statusMessage = Log.getCommandStatusString(command, status);
        Log.log(statusMessage, targetLogChannel || console);
    }

    /**
     * Logs a message to the console.
     */
    public static logToConsole(message: string, formatMessage: boolean = true) {
        console.log(formatMessage ?
            StreamLogFormatter.getFormattedMessage(message) :
            message);
    }

    /**
     * Logs a message to VS Code's Output Channel.
     */
    public static logToOutputChannel(message: string, outputChannel: OutputChannel, formatMessage: boolean = true) {
        outputChannel.appendLine(formatMessage ?
            OutputChannelLogFormatter.getFormattedMessage(message) :
            message);
        outputChannel.show();
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