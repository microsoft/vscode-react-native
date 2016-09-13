// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Formatter for the Output channel.
 */
import {LogHelper, LogLevel} from "./logHelper";

export interface ILogger {
    logMessage: (message: string, formatMessage?: boolean) => void;
    logError: (errorMessage: string, error?: any, logStack?: boolean) => void;
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

export class StreamLogger implements ILogger {
    private stream: NodeJS.WritableStream;
    constructor(stream: NodeJS.WritableStream) {
        this.stream = stream;
    }
    public logMessage(message: string, formatMessage: boolean = true) {
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

    public logStreamData(data: Buffer, stream: NodeJS.WritableStream) {
        stream.write(data.toString());
    }

    public logString(data: string) {
        this.logMessage(data, false);
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

    public setFocusOnLogChannel() {
        // Do nothing
        return;
    }
}

export class NodeDebugAdapterLogger implements ILogger {
    private debugSession: NodeDebugSession;
    private debugAdapterPackage: typeof VSCodeDebugAdapter;

    public constructor(adapterPackage: typeof VSCodeDebugAdapter, debugSession: NodeDebugSession) {
        this.debugAdapterPackage = adapterPackage;
        this.debugSession = debugSession;
    }

    public logMessage(message: string, formatMessage: boolean = true, destination: string = "stdout") {
        const outputEventMessage = formatMessage ? this.getFormattedMessage(message) : message;
        this.debugSession.sendEvent(new this.debugAdapterPackage.OutputEvent(outputEventMessage, destination));
    }

    public logError(errorMessage: string, error?: any, logStack: boolean = true) {
        this.logMessage(`${LogHelper.ERROR_TAG} ${errorMessage}\n`, false, "stderr");

        if (logStack && error && (<Error>error).stack) {
            this.logMessage(`Stack: ${(<Error>error).stack}`, false);
        }
    }

    public logStreamData(data: Buffer, stream: NodeJS.WritableStream) {
        this.logMessage(data.toString(), false);
    }

    public logString(data: string) {
        this.logMessage(data, false);
    }

    public logInternalMessage(logLevel: LogLevel, message: string) {
        this.logMessage(this.getFormattedInternalMessage(logLevel, message), false);
    }

    public getFormattedMessage(message: string) {
        return `${LogHelper.MESSAGE_TAG} ${message}\n`;
    }

    public getFormattedInternalMessage(logLevel: LogLevel, message: string) {
        return (`${LogHelper.INTERNAL_TAG} [${logLevel}] ${message}\n`);
    }

    public setFocusOnLogChannel() {
        // Do nothing
        return;
    }
}