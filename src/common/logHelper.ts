// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */


export enum LogLevel {
    None = 0,
    Error = 1,
    Warning = 2,
    Info = 3,
    Debug = 4,
    Trace = 5
}

export enum LogChannelType {
    Console = 0,
    OutputChannel = 1,
    WritableStream = 2
}

export class LogHelper {
    public static MESSAGE_TAG: string = "[vscode-react-native]";
    public static INTERNAL_TAG: string = "[Internal]";
    public static ERROR_TAG: string = `${LogHelper.MESSAGE_TAG} [Error]`;
    public static WARN_TAG: string = `${LogHelper.MESSAGE_TAG} [Warning]`;

    public static getLogChannelType(targetChannel: any): LogChannelType {
        if (!targetChannel) {
            return -1;
        } else if (typeof targetChannel.log === "function") {
            return LogChannelType.Console;
        } else if (typeof targetChannel.append === "function") {
            return LogChannelType.OutputChannel;
        } else if (typeof targetChannel.write === "function") {
            return LogChannelType.WritableStream;
        } else {
            return 0;
        }
    }


    /**
     * Gets the message of a non null error, if any. Otherwise it returns the empty string.
     */
    public static getErrorMessage(e: any): string {
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

    public static getExtensionLogLevel(): LogLevel {
        // TODO: Improve this logic. Make it case insensitive, etc...
        let logLevelIndex = process.argv.indexOf("--extensionLogLevel");
        if (logLevelIndex >= 0 && logLevelIndex + 1 < process.argv.length) {
            let logLevelText = process.argv[logLevelIndex + 1];
            return (<any>LogLevel)[logLevelText];
        } else {
            return LogLevel.None; // Default extension log level
        }
    }
}
