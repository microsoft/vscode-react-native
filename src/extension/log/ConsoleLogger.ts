// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ILogger, LogLevel, LogHelper } from "./LogHelper";

export class ConsoleLogger implements ILogger {
    public log(message: string, level: LogLevel): void {
        if (LogHelper.LOG_LEVEL === LogLevel.None) {
            return;
        }

        if (level >= LogHelper.LOG_LEVEL) {
            message = ConsoleLogger.getFormattedMessage(message, level);
            console.log(message);
        }
    }

    public info(message: string): void {
        this.log(message, LogLevel.Info);
    }

    public warning(message: string): void {
        this.log(message, LogLevel.Warning);
    }

    public error(errorMessage: string, error?: Error, logStack: boolean = true): void {
        console.error(ConsoleLogger.getFormattedMessage(errorMessage, LogLevel.Error));

        // Print the error stack if necessary
        if (logStack && error && error.stack) {
            console.error(`Stack: ${error.stack}`);
        }
    }

    public debug(message: string): void {
        this.log(message, LogLevel.Debug);
    }

    public logStream(data: Buffer, stream: NodeJS.WritableStream): void {
        stream.write(data.toString());
    }

    protected static getFormattedMessage(message: string, level: LogLevel): string {
        return `[${LogLevel[level]}] ${message}\n`;
    }
}
