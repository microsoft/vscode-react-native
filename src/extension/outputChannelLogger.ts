// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Formatter for the Output channel.
 */

import {ILogger} from "../common/log/loggers";
import {LogHelper, LogLevel} from "../common/log/logHelper";
import {OutputChannel} from "vscode";
import * as vscode from "vscode";

export class DelayedOutputChannelLogger implements ILogger {
    private outputChannelLogger: OutputChannelLogger;

    constructor(private channelName: string) {}

    public logInternalMessage(logLevel: LogLevel, message: string) {
        this.logger.logInternalMessage(logLevel, message);
    }

    public logMessage(message: string, formatMessage: boolean = true ) {
        this.logger.logMessage(message, formatMessage);
    }

    public logError(errorMessage: string, error?: any, logStack: boolean = true) {
       this.logger.logError(errorMessage, error, logStack);
    }

    public logStreamData(data: Buffer, stream: NodeJS.WritableStream) {
        this.logger.logStreamData(data, stream);
    }

    public logString(data: string) {
        this.logger.logString(data);
    }

    public setFocusOnLogChannel() {
        this.logger.setFocusOnLogChannel();
    }

    private get logger(): OutputChannelLogger {
        if (!this.outputChannelLogger) {
            this.outputChannelLogger = new OutputChannelLogger(vscode.window.createOutputChannel(this.channelName));
        }
        return this.outputChannelLogger;
    }
}

export class OutputChannelLogger implements ILogger {
    private outputChannel: OutputChannel;

    constructor(outputChannel: OutputChannel) {
        this.outputChannel = outputChannel;
        this.outputChannel.show();
    }

    public logInternalMessage(logLevel: LogLevel, message: string) {
        console.log(this.getFormattedInternalMessage(logLevel, message));
    }

    public logMessage(message: string, formatMessage: boolean = true ) {
        this.outputChannel.appendLine(formatMessage ?
            this.getFormattedMessage(message) :
            message);
    }

    public logError(errorMessage: string, error?: any, logStack: boolean = true) {
        this.logMessage(errorMessage, /* formatMessage */ false);
    }

    public logStreamData(data: Buffer, stream: NodeJS.WritableStream) {
        this.outputChannel.append(data.toString());
    }

    public logString(data: string) {
        this.outputChannel.append(data);
    }

    public setFocusOnLogChannel() {
        this.outputChannel.show();
    }

    private getFormattedMessage(message: string) {
        return `######### ${message} ##########`;
    }

    private getFormattedInternalMessage(logLevel: LogLevel, message: string) {
        return (`${LogHelper.INTERNAL_TAG} [${LogLevel[logLevel]}] ${message}`);
    }
}