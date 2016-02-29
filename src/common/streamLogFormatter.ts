// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

import {LogHelper} from "./logHelper";

export class StreamLogFormatter {

    public static getFormattedMessage(message: string) {
        return `${LogHelper.MESSAGE_TAG} ${message}\n`;
    }

    public static getFormattedWarning(message: string) {
        return `${LogHelper.WARN_TAG} ${message}\n`;
    }

    public static getFormattedInternalMessage(logLevel: string, message: string) {
        return (`${LogHelper.INTERNAL_TAG} [${logLevel}] ${message}\n`);
    }

    public static getFormattedErrorMessage(message: string) {
        return `${LogHelper.ERROR_TAG} ${message}`;
    }
}