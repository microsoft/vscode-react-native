// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Helper for the log utility.
 */

import * as util from "util";
import {InternalError, InternalErrorLevel} from "../error/internalError";

export enum LogLevel {
    None = 0,
    Error = 1,
    Warning = 2,
    Info = 3,
    Debug = 4,
    Trace = 5,
}

export class LogHelper {
    public static PREFIX: string = "";

    private static message_tag: string = "[vscode-react-native]";
    private static internal_tag: string = "[Internal]";
    private static error_tag_formatstring: string = "[Error : %s]";
    private static error_tag: string = "[Error]";
    private static warn_tag: string = "[Warning]";
    private static ERROR_CODE_WIDTH: string = "0000";
    private static LOG_LEVEL_NAME: string = "RN_LOG_LEVEL";

    public static get MESSAGE_TAG(): string {
        return `${LogHelper.message_tag} ${LogHelper.PREFIX}`;
    }

    public static set MESSAGE_TAG(newVal: string) {
        LogHelper.message_tag = newVal;
    }

    public static get INTERNAL_TAG(): string {
        return `${LogHelper.internal_tag} ${LogHelper.PREFIX}`;
    }

    public static set INTERNAL_TAG(newVal: string) {
        LogHelper.internal_tag = newVal;
    }

    public static get ERROR_TAG_FORMATSTRING(): string {
        return `${LogHelper.error_tag_formatstring} ${LogHelper.PREFIX}`;
    }

    public static set ERROR_TAG_FORMATSTRING(newVal: string) {
        LogHelper.error_tag_formatstring = newVal;
    }

    public static get ERROR_TAG(): string {
        return `${LogHelper.error_tag} ${LogHelper.PREFIX}`;
    }

    public static set ERROR_TAG(newVal: string) {
        LogHelper.error_tag = newVal;
    }

    public static get WARN_TAG(): string {
        return `${LogHelper.warn_tag} ${LogHelper.PREFIX}`;
    }

    public static set WARN_TAG(newVal: string) {
        LogHelper.warn_tag = newVal;
    }


    public static get logLevel(): LogLevel {
        let valName: string = process.env[LogHelper.LOG_LEVEL_NAME];

        if (typeof(valName) === "undefined") {
            valName = "None"; // Set the default LogLevel to LogLevel.None
        }

        return (<any> LogLevel)[valName];
    }

    public static set logLevel(level: LogLevel) {
        if (!level) {
            return;
        }

        // Set the process env value
        process.env[LogHelper.LOG_LEVEL_NAME] = LogLevel[level];
    }

    /**
     * Gets the message of a non null error, if any. Otherwise it returns the empty string.
     */
     public static getErrorString(e: any): string {

        if (e.isInternalError) {
            let errorMessage = e.message;
            let errorMessagePrefix = LogHelper.getErrorMessagePrefix(e);
            return errorMessagePrefix + " " + errorMessage;
       } else {
            let message = e.message || e.error && e.error.message;
            if (!message) {
                try {
                    return JSON.stringify(e);
                } catch (exception) {
                    // This is a best-effort feature, so we ignore any exceptions. If possible we'll print the error stringified.
                    // If not, we'll just use one of the fallbacks
                    return e.error || e.toString() || "";
                }
            } else {
                return message;
            }
        }
    }

    private static getErrorMessagePrefix(error: InternalError) {
        if (!error) {
            return "";
        }

        switch (error.errorLevel) {
            case InternalErrorLevel.Error:
                // Encode the error code to a four-char code - ex, 0198
                let errorCodeString = (LogHelper.ERROR_CODE_WIDTH + error.errorCode).slice(-LogHelper.ERROR_CODE_WIDTH.length);
                return util.format(LogHelper.ERROR_TAG_FORMATSTRING, errorCodeString);
            case InternalErrorLevel.Warning:
                return `${LogHelper.WARN_TAG}`;
            default:
                return `${LogHelper.WARN_TAG}`;
        }
    }
}
