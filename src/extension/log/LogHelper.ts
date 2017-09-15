// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Logging utility class.
 */

export enum LogLevel {
    Trace = 0,
    Debug = 1,
    Info = 2,
    Warning = 3,
    Error = 4,
    None = 5,
}

export interface ILogger {
    log: (message: string, level: LogLevel) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
    error: (errorMessage: string, error?: Error, stack?: boolean) => void;
    debug: (message: string) => void;
    logStream: (data: Buffer | String, stream?: NodeJS.WritableStream) => void;
}

export class LogHelper {
    public static get LOG_LEVEL(): LogLevel {
        return getLogLevel();
    }
}

function getLogLevel() {
    try {
        const SettingsHelper = require("../settingsHelper").SettingsHelper;
        return SettingsHelper.getLogLevel();
    } catch (err) { // Debugger context
        return LogLevel.Info; // Default
    }
}
