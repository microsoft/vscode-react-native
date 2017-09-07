// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Formatter for the Output channel.
 */

import * as vscode from "vscode";
import { Log } from "./log";
import { ILogger } from "./loggers";
import { LogHelper, LogLevel } from "./logHelper";
import { SettingsHelper } from "../../extension/settingsHelper";
import {OutputChannel} from "vscode";

export class OutputChannelLogger implements ILogger {
    private outputChannel: OutputChannel;

    constructor(outputChannel: any) {
        this.outputChannel = outputChannel;
        this.outputChannel.show();
    }

    public logInternalMessage(logLevel: LogLevel, message: string) {
        if (SettingsHelper.getShowInternalLogs()) {
            this.logMessage(this.getFormattedInternalMessage(logLevel, message));
            return;
        }
        console.log(this.getFormattedInternalMessage(logLevel, message));
    }

    public logMessage(message: string, formatMessage: boolean = true) {
        this.outputChannel.appendLine(formatMessage ?
            this.getFormattedMessage(message) :
            message);
    }

    public logError(errorMessage: string, error?: any, logStack: boolean = true) {
        this.logMessage(errorMessage, /* formatMessage */ false);
    }

    public logWarning(error?: any, logStack = true) {
        this.logError(error, logStack);
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

    public getOutputChannel(): any {
        return this.outputChannel;
    }

    public clear() {
        this.outputChannel.clear();
    }

    private getFormattedMessage(message: string) {
        return `######### ${message} ##########`;
    }

    private getFormattedInternalMessage(logLevel: LogLevel, message: string) {
        return (`${LogHelper.INTERNAL_TAG} [${LogLevel[logLevel]}] ${message}`);
    }
}

export class DelayedOutputChannelLogger implements ILogger {
    private outputChannel: OutputChannelLogger;

    constructor(private channelName: string) { }

    public logInternalMessage(logLevel: LogLevel, message: string) {
        this.logger.logInternalMessage(logLevel, message);
    }

    public logMessage(message: string, formatMessage: boolean = true) {
        this.logger.logMessage(message, formatMessage);
    }

    public logError(errorMessage: string, error?: any, logStack: boolean = true) {
        this.logger.logError(errorMessage, error, logStack);
    }

    public logWarning(error?: any, logStack = true) {
        this.logger.logError(error, logStack);
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

    public clear() {
        if (this.outputChannel) {
            this.outputChannel.getOutputChannel().clear();
        }
    }

    private get logger(): OutputChannelLogger {
        if (!this.outputChannel) {
            this.outputChannel = Log.getLoggerWithCache(OutputChannelLogger, this.channelName, vscode.window.createOutputChannel(this.channelName));
        }
        return this.outputChannel;
    }
}
