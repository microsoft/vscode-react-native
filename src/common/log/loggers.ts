// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Formatter for the Output channel.
 */
import {LogHelper, LogLevel} from "./logHelper";

export interface ILogger {
    logMessage: (message: string, formatMessage?: boolean) => void;
    logError: (errorMessage: string, error?: any, logStack?: boolean) => void;
    logWarning: (error?: any, logStack?: boolean) => void;
    logStreamData: (data: Buffer, stream: NodeJS.WritableStream) => void;
    logString: (data: string) => void;
    logInternalMessage: (logLevel: LogLevel, message: string) => void;
    setFocusOnLogChannel: () => void;
}

export class ConsoleLogger implements ILogger {
    public logMessage(message: string, formatMessage: boolean = true) {
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

    public logWarning(error?: any, logStack = true) {
        this.logError(error, logStack);
    }

    public logStreamData(data: Buffer, stream: NodeJS.WritableStream) {
        stream.write(data.toString());
    }

    public logString(data: string) {
        this.logMessage(data, false);
    }

    public logInternalMessage(logLevel: LogLevel, message: string) {
        this.logMessage(this.getFormattedInternalMessage(logLevel, message), /* formatMessage */ false);
    }

    public setFocusOnLogChannel() {
        // Do nothing - console takes focus automatically upon logging
        return;
    }

    private getFormattedMessage(message: string) {
        return `${LogHelper.MESSAGE_TAG} ${message}\n`;
    }

    private getFormattedInternalMessage(logLevel: LogLevel, message: string) {
        return (`${LogHelper.INTERNAL_TAG} [${LogLevel[logLevel]}] ${message}\n`);
    }
}
