// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

import {CommandStatus} from "../commandExecutor";
import {LogHelper, LogChannelType, LogLevel} from "./logHelper";
import {ILogger, OutputChannelLogger, StreamLogger, ConsoleLogger} from "./loggers";
import {OutputChannel} from "vscode";

export module Log {
    let globalLogger: ILogger;
    /**
     * Logs a message.
     */
    export function CreateGlobalLogger(targetChannel?: any) {
        switch (LogHelper.getLogChannelType(targetChannel)) {
            case LogChannelType.OutputChannel:
                globalLogger = new OutputChannelLogger(targetChannel);
                break;

            case LogChannelType.WritableStream:
                globalLogger = new StreamLogger(targetChannel);
                break;

            case LogChannelType.Console:
            default:
                globalLogger = new ConsoleLogger();
                break;
        }
    }

    /**
     * Logs a message.
     */
    export function logMessage(message: string, formatMessage: boolean = true) {
        globalLogger ? globalLogger.logMessage(message, formatMessage) : new ConsoleLogger().logMessage(message, formatMessage);
    }

    /**
     * Logs an error message.
     */
    export function logError(error?: any, logStack = true) {
        let errorMessageToLog = LogHelper.getErrorString(error);
        globalLogger ? globalLogger.logError(errorMessageToLog, error, logStack) : new ConsoleLogger().logError(errorMessageToLog, error, logStack);
    }

    /**
     * Logs a warning message.
     */
    export function logWarning(error?: any, logStack = true) {
        Log.logError(error, logStack);
    }

    /**
     * Logs an internal message for when someone is debugging the extension itself.
     * Customers aren't interested in these messages, so we normally shouldn't show
     * them to them.
     */
    export function logInternalMessage(logLevel: LogLevel, message: string) {
        if (LogHelper.logLevel >= logLevel) {
            globalLogger ? globalLogger.logInternalMessage(logLevel, message) : new ConsoleLogger().logInternalMessage(logLevel, message);
        }
    }

    /**
     * Logs the status (Start/End) of a command.
     */
    export function logCommandStatus(command: string, status: CommandStatus) {
        console.assert(status >= CommandStatus.Start && status <= CommandStatus.End, "Unsupported Command Status");

        let statusMessage = Log.getCommandStatusString(command, status);
        globalLogger ? globalLogger.logMessage(statusMessage) : new ConsoleLogger().logMessage(statusMessage);
    }

    /**
     * Logs a message to the console.
     */
    export function logToConsole(message: string, formatMessage: boolean = true) {
        new ConsoleLogger().logMessage(message, formatMessage);
    }

    /**
     * Logs a message to VS Code's Output Channel.
     */
    export function logToOutputChannel(outputChannel: OutputChannel, message: string, formatMessage: boolean = true) {
        new OutputChannelLogger(outputChannel).logMessage(message, formatMessage);
    }

    /**
     * Logs a message to the console.
     */
    export function logToStderr(message: string, formatMessage: boolean = true) {
        new StreamLogger(process.stderr).logMessage(message, formatMessage);
    }

    /**
     * Logs a message to the console.
     */
    export function logToStdout(message: string, formatMessage: boolean = true) {
        new StreamLogger(process.stdout).logMessage(message, formatMessage);
    }

    export function getCommandStatusString(command: string, status: CommandStatus) {
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
}