// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

import {CommandStatus} from "../commandExecutor";
import {LogHelper, LogLevel} from "./logHelper";
import {ILogger, StreamLogger, ConsoleLogger} from "./loggers";

export module Log {
    /**
     * The global logger defaults to the Console logger.
     */
    let globalLogger: ILogger = new ConsoleLogger();

    /**
     * Sets the global logger.
     */
    export function SetGlobalLogger(logger: ILogger) {
        globalLogger = logger;
    }

    /**
     * Logs a message.
     */
    export function logMessage(message: string, formatMessage: boolean = true) {
        globalLogger.logMessage(message, formatMessage);
    }

    /**
     * Logs an error message.
     */
    export function logError(error?: any, logStack = true) {
        let errorMessageToLog = LogHelper.getErrorString(error);
        globalLogger.logError(errorMessageToLog, error, logStack);
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
            globalLogger.logInternalMessage(logLevel, message);
        }
    }

    /**
     * Logs the status (Start/End) of a command.
     */
    export function logCommandStatus(command: string, status: CommandStatus) {
        console.assert(status >= CommandStatus.Start && status <= CommandStatus.End, "Unsupported Command Status");

        let statusMessage = Log.getCommandStatusString(command, status);
        globalLogger.logMessage(statusMessage);
    }

    /**
     * Logs a stream data buffer.
     */
    export function logStreamData(data: Buffer, stream: NodeJS.WritableStream) {
        globalLogger.logStreamData(data, stream);
    }

    /**
     * Logs string
     */
    export function logString(data: string) {
        globalLogger.logString(data);
    }

    /**
     * Brings the target output window to focus.
     */
    export function setFocusOnLogChannel() {
        globalLogger.setFocusOnLogChannel();
    }

    /**
     * Logs a message to the console.
     */
    export function logWithLogger(logger: ILogger, message: string, formatMessage: boolean) {
        logger.logMessage(message, formatMessage);
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