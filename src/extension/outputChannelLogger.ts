// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Formatter for the Output channel.
 */

import {ILogger} from "../common/log/loggers";
import {LogHelper, LogLevel} from "../common/log/logHelper";
import {OutputChannel} from "vscode";

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

    public setFocusOnLocalChannel() {
        this.outputChannel.show();
    }

    private getFormattedMessage(message: string) {
        return `######### ${message} ##########`;
    }

    private getFormattedInternalMessage(logLevel: LogLevel, message: string) {
        return (`${LogHelper.INTERNAL_TAG} [${LogLevel[logLevel]}] ${message}`);
    }
}