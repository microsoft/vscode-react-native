// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { appendFileSync, writeFileSync } from "fs";
import { format } from "util";
import { EOL } from "os";

export interface Logger {
    log(message: string, ...args: any[]): void;
}

export class ConsoleLogger implements Logger {
    public log(message: string, ...args: any[]): void {
        console.log("**", message, ...args);
    }
}

export class FileLogger implements Logger {
    constructor(private path: string) {
        writeFileSync(path, "");
    }

    public log(message: string, ...args: any[]): void {
        const date = new Date().toISOString();
        appendFileSync(this.path, `[${date}] ${format(message, ...args)}${EOL}`);
    }
}

export class MultiLogger implements Logger {
    constructor(private loggers: Logger[]) {}

    public log(message: string, ...args: any[]): void {
        for (const logger of this.loggers) {
            logger.log(message, ...args);
        }
    }
}
