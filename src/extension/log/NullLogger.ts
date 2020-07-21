// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ILogger, LogLevel } from "./LogHelper";

export class NullLogger implements ILogger {
    public log(message: string, level: LogLevel | undefined) {}
    public info(message: string) {}
    public warning(message: string) {}
    public error(errorMessage: string, error?: Error | undefined, stack?: boolean | undefined) {}
    public debug(message: string) {}
    public logStream(data: string | Buffer, stream?: NodeJS.WritableStream | undefined) {}
}
