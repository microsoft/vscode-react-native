// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Formatter for the Output channel.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getFormattedDatetimeString } from "../../common/utils";
import { ILogger, LogLevel, LogHelper, getLoggingDirectory } from "./LogHelper";

const channels: { [channelName: string]: OutputChannelLogger } = {};

export class OutputChannelLogger implements ILogger {
    public static MAIN_CHANNEL_NAME: string = "React Native";
    private readonly channelLogFilePath: string | undefined;
    private channelLogFileStream: fs.WriteStream;
    private outputChannel: vscode.OutputChannel;
    private logTimestamps: boolean;
    private static forbiddenFileNameSymbols: RegExp = /\W/gi;

    public static disposeChannel(channelName: string): void {
        if (channels[channelName]) {
            channels[channelName].getOutputChannel().dispose();
            if (channels[channelName].channelLogFileStream) {
                channels[channelName].channelLogFileStream.end();
            }
            delete channels[channelName];
        }
    }

    public static getMainChannel(): OutputChannelLogger {
        return this.getChannel(this.MAIN_CHANNEL_NAME, true);
    }

    public static getChannel(
        channelName: string,
        lazy?: boolean,
        preserveFocus?: boolean,
        logTimestamps?: boolean,
    ): OutputChannelLogger {
        if (!channels[channelName]) {
            channels[channelName] = new OutputChannelLogger(
                channelName,
                lazy,
                preserveFocus,
                logTimestamps,
            );
        }
        return channels[channelName];
    }

    constructor(
        public readonly channelName: string,
        lazy: boolean = false,
        private preserveFocus: boolean = false,
        logTimestamps: boolean = false,
    ) {
        this.logTimestamps = logTimestamps;
        const channelLogFolder = getLoggingDirectory();
        if (channelLogFolder) {
            const filename = channelName.replace(OutputChannelLogger.forbiddenFileNameSymbols, "");
            this.channelLogFilePath = path.join(channelLogFolder, `${filename}.txt`);
            this.channelLogFileStream = fs.createWriteStream(this.channelLogFilePath);
            this.channelLogFileStream.on("error", err => {
                this.error(
                    `Error writing to log file at path: ${
                        this.channelLogFilePath
                    }. Error: ${err.toString()}\n`,
                );
            });
        }
        if (!lazy) {
            this.channel = vscode.window.createOutputChannel(this.channelName);
            this.channel.show(this.preserveFocus);
        }
    }

    public log(message: string, level: LogLevel): void {
        if (LogHelper.LOG_LEVEL === LogLevel.None) {
            return;
        }

        if (level >= LogHelper.LOG_LEVEL) {
            message = OutputChannelLogger.getFormattedMessage(
                message,
                LogLevel[level],
                this.logTimestamps,
            );
            this.channel.appendLine(message);
            if (this.channelLogFileStream) {
                this.channelLogFileStream.write(message);
            }
        }
    }

    public logWithCustomTag(tag: string, message: string, level: LogLevel): void {
        if (LogHelper.LOG_LEVEL === LogLevel.None) {
            return;
        }

        if (level === LogLevel.Custom) {
            message = OutputChannelLogger.getFormattedMessage(message, tag, this.logTimestamps);
            this.channel.appendLine(message);
            if (this.channelLogFileStream) {
                this.channelLogFileStream.write(message);
            }
        }
    }

    public info(message: string): void {
        this.log(message, LogLevel.Info);
    }

    public warning(message: string | Error): void {
        this.log(message.toString(), LogLevel.Warning);
    }

    public error(errorMessage: string, error?: Error, logStack: boolean = true): void {
        const message = OutputChannelLogger.getFormattedMessage(
            errorMessage,
            LogLevel[LogLevel.Error],
            this.logTimestamps,
        );
        this.channel.appendLine(message);
        if (this.channelLogFileStream) {
            this.channelLogFileStream.write(message);
        }

        // Print the error stack if necessary
        if (logStack && error && (<Error>error).stack) {
            this.channel.appendLine(`Stack: ${(<Error>error).stack}`);
            if (this.channelLogFileStream) {
                this.channelLogFileStream.write(`Stack: ${(<Error>error).stack}`);
            }
        }
    }

    public debug(message: string): void {
        this.log(message, LogLevel.Debug);
    }

    public logStream(data: Buffer | string): void {
        this.channel.append(data.toString());
        if (this.channelLogFileStream) {
            this.channelLogFileStream.write(data);
        }
    }

    public setFocusOnLogChannel(): void {
        this.channel.show(false);
    }

    protected static getFormattedMessage(
        message: string,
        tag: string,
        prependTimestamp: boolean = false,
    ): string {
        let formattedMessage = `[${tag}] ${message}\n`;

        if (prependTimestamp) {
            formattedMessage = `[${getFormattedDatetimeString(new Date())}] ${formattedMessage}`;
        }

        return formattedMessage;
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
        }
        this.outputChannel = vscode.window.createOutputChannel(this.channelName);
        this.outputChannel.show(this.preserveFocus);
        return this.outputChannel;
    }

    private set channel(channel: vscode.OutputChannel) {
        this.outputChannel = channel;
    }
}
