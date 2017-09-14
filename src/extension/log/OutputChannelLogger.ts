// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Formatter for the Output channel.
 */

import * as vscode from "vscode";
import { ILogger, LogLevel, LogHelper } from "./LogHelper";

export class OutputChannelLogger implements ILogger {
    private outputChannelName: string;
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannelName: string, lazy: boolean = false, private preserveFocus: boolean = false) {
        this.outputChannelName = outputChannelName;
        if (!lazy) {
            this.channel = vscode.window.createOutputChannel(this.outputChannelName);
            this.channel.show(this.preserveFocus);
        }
    }

    public log(message: string, level?: LogLevel): void {
        if (LogHelper.LOG_LEVEL === LogLevel.None) {
            return;
        }

        if (level) {
            if (level >= LogHelper.LOG_LEVEL) {
                message = OutputChannelLogger.getFormattedMessage(message, level);
                this.channel.appendLine(message);
            }
        } else {
            this.channel.appendLine(message);
        }
    }

    public info(message: string): void {
        this.log(message, LogLevel.Info);
    }

    public warning(message: string | Error, logStack = false): void {
        this.log(message.toString(), LogLevel.Warning);
    }

    public error(errorMessage: string, error?: Error, logStack: boolean = true): void {
        this.channel.appendLine(OutputChannelLogger.getFormattedMessage(errorMessage, LogLevel.Error));

        // Print the error stack if necessary
        if (logStack && error && (<Error>error).stack) {
            this.channel.appendLine(`Stack: ${(<Error>error).stack}`);
        }
    }

    public debug(message: string): void {
        this.log(OutputChannelLogger.getFormattedMessage(message, LogLevel.Debug));
    }

    public logStream(data: Buffer | string) {
        this.channel.append(data.toString());
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
            this.outputChannel = vscode.window.createOutputChannel(this.outputChannelName);
            this.outputChannel.show(this.preserveFocus);
            return this.outputChannel;
        }
    }

    private set channel(channel: vscode.OutputChannel) {
        this.outputChannel = channel;
    }
}
