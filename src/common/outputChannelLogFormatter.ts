// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

import {LogHelper} from "./logHelper";

export class OutputChannelLogFormatter {

    public static getFormattedMessage(message: string) {
        return OutputChannelLogFormatter.getFormattedOutputChannelString(message);
    }

    public static getFormattedWarning(message: string, targetChannel: any) {
        return OutputChannelLogFormatter.getFormattedOutputChannelString(message);
    }

    public static getFormattedInternalMessage(logLevel: string, message: string) {
        return (`${LogHelper.INTERNAL_TAG} [${logLevel}] ${message}`);
    }

    public static getFormattedErrorMessage(message: string) {
        return OutputChannelLogFormatter.getFormattedOutputChannelString(message);
    }

    private static getFormattedOutputChannelString(message: string) {
        return `######### ${message} ##########`;
    }
}