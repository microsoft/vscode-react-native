// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

import {LogHelper, LogLevel} from "./logHelper";
import {ILogger, ConsoleLogger} from "./loggers";

export class Log {
    // private static loggersCache = {};
    /**
     * The global logger defaults to the Console logger.
     */
    private static globalLogger: ILogger = new ConsoleLogger();
    private static loggersCache = {};

    /**
     * Sets the global logger.
     */
    public static set GlobalLogger(logger: ILogger) {
        this.globalLogger = logger;
    }

    /**
     * Sets the global logger.
     */
    public static get GlobalLogger(): ILogger {
        return this.globalLogger;
    }

    public static getLogger<T extends ILogger>(loggerType: new (...args: any[]) => T, ...args: any[]): T {
        return new loggerType(...args);
    }

    public static getLoggerWithCache<T extends ILogger>(loggerType: new (...args: any[]) => T, name: string, ...args: any[]): T {
        return this.loggersCache[name] ? this.loggersCache[name] : this.loggersCache[name] = this.getLogger(loggerType, ...args);
    }

    public static clearCacheByName(name: string): void {
        delete this.loggersCache[name];
    }

    /**
     * Logs a message.
     */
    public static logMessage(message: string, formatMessage: boolean = true) {
        this.globalLogger.logMessage(message, formatMessage);
    }

    /**
     * Logs an error message.
     */
    public static logError(error?: any, logStack = true) {
        let errorMessageToLog = LogHelper.getErrorString(error);
        this.globalLogger.logError(errorMessageToLog, error, logStack);
    }

    /**
     * Logs a warning message.
     */
    public static logWarning(error?: any, logStack = true) {
        Log.logError(error, logStack);
    }

    /**
     * Logs an internal message for when someone is debugging the extension itself.
     * Customers aren't interested in these messages, so we normally shouldn't show
     * them to them.
     */
    public static logInternalMessage(logLevel: LogLevel, message: string) {
        if (LogHelper.logLevel >= logLevel) {
            this.globalLogger.logInternalMessage(logLevel, message);
        }
    }

    /**
     * Logs a stream data buffer.
     */
    public static logStreamData(data: Buffer, stream: NodeJS.WritableStream) {
        this.globalLogger.logStreamData(data, stream);
    }

    /**
     * Logs string
     */
    public static logString(data: string) {
        this.globalLogger.logString(data);
    }

    /**
     * Brings the target output window to focus.
     */
    public static setFocusOnLogChannel() {
        this.globalLogger.setFocusOnLogChannel();
    }
}