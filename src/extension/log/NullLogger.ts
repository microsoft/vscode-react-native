// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ILogger, LogLevel } from "./LogHelper";

export class NullLogger implements ILogger {
    /* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
    public log(message: string, level: LogLevel | undefined): void {}
    public info(message: string): void {}
    public warning(message: string): void {}
    public error(
        errorMessage: string,
        error?: Error | undefined,
        stack?: boolean | undefined,
    ): void {}
    public debug(message: string): void {}
    public logStream(data: string | Buffer, stream?: NodeJS.WritableStream | undefined): void {}
    /* eslint-enable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
}
