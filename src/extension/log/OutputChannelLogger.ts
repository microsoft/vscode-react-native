// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Formatter for the Output channel.
 */

import * as vscode from "vscode";
import { ILogger, LogLevel, LogHelper } from "./LogHelper";
import * as fs from "fs";

const channels: { [channelName: string]: OutputChannelLogger } = {};

export class OutputChannelLogger implements ILogger {
    public static MAIN_CHANNEL_NAME: string = "React Native";
    private filename: string;
    private outputChannel: vscode.OutputChannel;
    private static forbiddenFileNameSymbols: RegExp = /\W/gi;

    public static disposeChannel(channelName: string): void {
        if (channels[channelName]) {
            channels[channelName].getOutputChannel().dispose();
            delete channels[channelName];
        }
    }

    public static getMainChannel(): OutputChannelLogger {
        return this.getChannel(this.MAIN_CHANNEL_NAME, true);
    }

    public static getChannel(channelName: string, lazy?: boolean, preserveFocus?: boolean): OutputChannelLogger {
        if (!channels[channelName]) {
            channels[channelName] = new OutputChannelLogger(channelName, lazy, preserveFocus);
        }
        return channels[channelName];
    }

    constructor(public readonly channelName: string, lazy: boolean = false, private preserveFocus: boolean = false) {
        if (!lazy) {
            this.channel = vscode.window.createOutputChannel(this.channelName);
            this.channel.show(this.preserveFocus);
            this.filename = channelName.replace(OutputChannelLogger.forbiddenFileNameSymbols, "");
        }
    }

    public log(message: string, level: LogLevel): void {
        if (LogHelper.LOG_LEVEL === LogLevel.None) {
            return;
        }

        if (level >= LogHelper.LOG_LEVEL) {
            message = OutputChannelLogger.getFormattedMessage(message, level);
            this.channel.appendLine(message);
            fs.writeFile(this.filename, message, {mode: "a"}, () => {});
        }
    }

    public info(message: string): void {
        this.log(message, LogLevel.Info);
    }

    public warning(message: string | Error, logStack = false): void {
        this.log(message.toString(), LogLevel.Warning);
    }

    public error(errorMessage: string, error?: Error, logStack: boolean = true): void {
        const message = OutputChannelLogger.getFormattedMessage(errorMessage, LogLevel.Error);
        this.channel.appendLine(message);
        fs.writeFile(this.filename, message, {mode: "a"}, () => {});

        // Print the error stack if necessary
        if (logStack && error && (<Error>error).stack) {
            this.channel.appendLine(`Stack: ${(<Error>error).stack}`);
            fs.writeFile(this.filename, `Stack: ${(<Error>error).stack}`, {mode: "a"}, () => {});
        }
    }

    public debug(message: string): void {
        this.log(message, LogLevel.Debug);
    }

    public logStream(data: Buffer | string) {
        this.channel.append(data.toString());
        fs.writeFile(this.filename, data.toString(), {mode: "a"}, () => {});
    }

    public setFocusOnLogChannel(): void {
        this.channel.show(false);
    }

    protected static getFormattedMessage(message: string, level: LogLevel): string {
        return `[${LogLevel[level]}] ${message}\n`;
    }

    public getOutputChannel(): vscode.OutputChannel {
        return this.channel;
    }

    public clear(): void {
        this.channel.clear();
    }

    private get channel(): vscode.OutputChannel {
        if (this.outputChannel) {
            return this.outputChannel;
        } else {
            this.outputChannel = vscode.window.createOutputChannel(this.channelName);
            this.outputChannel.show(this.preserveFocus);
            return this.outputChannel;
        }
    }

    private set channel(channel: vscode.OutputChannel) {
        this.outputChannel = channel;
    }
}
