// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Formatter for the Output channel.
 */

import {LogHelper} from "./logHelper";

export class OutputChannelLogFormatter {

    public static getFormattedMessage(message: string) {
        return OutputChannelLogFormatter.getFormattedOutputChannelString(message);
    }

    public static getFormattedInternalMessage(logLevel: string, message: string) {
        return (`${LogHelper.INTERNAL_TAG} [${logLevel}] ${message}`);
    }

    private static getFormattedOutputChannelString(message: string) {
        return `######### ${message} ##########`;
    }
}