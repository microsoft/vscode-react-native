// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Formatter for the Output channel.
 */
import {LogHelper, LogLevel} from "./logHelper";

export interface ILogger {
    logMessage: (message: string, formatMessage?: boolean) => void;
    logError: (errorMessage: string, error?: any, logStack?: boolean) => void;
    logInternalMessage?: (logLevel: LogLevel, message: string) => void;
}

export class ConsoleLogger implements ILogger {
    public logMessage(message: string, formatMessage: boolean = true ) {
        console.log(formatMessage ?
            this.getFormattedMessage(message) :
            message);
    }

    public logError(errorMessage: string, error?: any, logStack: boolean = true) {
        console.error(this.getFormattedMessage(errorMessage));

        // Print the error stack if necessary
        if (logStack && error && (<Error>error).stack) {
            console.error(`Stack: ${(<Error>error).stack}`);
        }
    }

    public logInternalMessage(logLevel: LogLevel, message: string) {
        this.logMessage(this.getFormattedInternalMessage(logLevel, message), /* formatMessage */ false);
    }

    private getFormattedMessage(message: string) {
        return `${LogHelper.MESSAGE_TAG} ${message}\n`;
    }

    private getFormattedInternalMessage(logLevel: LogLevel, message: string) {
        return (`${LogHelper.INTERNAL_TAG} [${LogLevel[logLevel]}] ${message}\n`);
    }
}

export class StreamLogger implements ILogger {
    private stream: NodeJS.WritableStream;
    constructor(stream: NodeJS.WritableStream) {
        this.stream = stream;
    }
    public logMessage(message: string, formatMessage: boolean = true ) {
        this.stream.write(formatMessage ?
            this.getFormattedMessage(message) :
            message);
    }

    public logError(errorMessage: string, error?: any, logStack: boolean = true) {
        this.logMessage(errorMessage);

        if (logStack && error && (<Error>error).stack) {
            this.logMessage(`Stack: ${(<Error>error).stack}`, /* formatMessage */ false);
        }
    }

    public logInternalMessage(logLevel: LogLevel, message: string) {
        this.logMessage(this.getFormattedInternalMessage(logLevel, message), /* formatMessage */ false);
    }

    public getFormattedMessage(message: string) {
        return `${LogHelper.MESSAGE_TAG} ${message}\n`;
    }

    public getFormattedInternalMessage(logLevel: LogLevel, message: string) {
        return (`${LogHelper.INTERNAL_TAG} [${logLevel}] ${message}\n`);
    }
}