// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Formatter for the Output channel.
 */

import {ILogger} from "../common/log/loggers";
import {OutputChannel} from "vscode";

export class OutputChannelLogger implements ILogger {
    private outputChannel: OutputChannel;

    constructor(outputChannel: OutputChannel) {
        this.outputChannel = outputChannel;
    }

    public logMessage(message: string, formatMessage: boolean = true ) {
        this.outputChannel.appendLine(formatMessage ?
            this.getFormattedMessage(message) :
            message);
        this.outputChannel.show();
    }

    public logError(errorMessage: string, error?: any, logStack: boolean = true) {
        this.logMessage(errorMessage, /* formatMessage */ false);
    }

    private getFormattedMessage(message: string) {
        return `######### ${message} ##########`;
    }
}