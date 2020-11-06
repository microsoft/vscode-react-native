// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";

export class SmokeTestLogger {
    private static colors = {
        blue: "\x1b[34m",
        yellow: "\x1b[33m",
        green: "\x1b[32m",
        red: "\x1b[31m",
    };

    private static resetMark = "\x1b[0m";

    private static colorize(str: string, color: string) {
        return `${color}${str}${SmokeTestLogger.resetMark}`;
    }

    public static log(...str: string[]) {
        console.log(...str);
    }
    public static info(...str: string[]) {
        console.log(SmokeTestLogger.colorize(str.join(" "), SmokeTestLogger.colors.blue));
    }
    public static warn(...str: string[]) {
        console.log(SmokeTestLogger.colorize(str.join(" "), SmokeTestLogger.colors.yellow));
    }
    public static success(...str: string[]) {
        console.log(SmokeTestLogger.colorize(str.join(" "), SmokeTestLogger.colors.green));
    }
    public static error(err: string | Error) {
        console.error(SmokeTestLogger.colorize(err.toString(), SmokeTestLogger.colors.red));
    }
    public static saveLogsInFile(str: string, filePath: string) {
        if (!fs.existsSync(filePath)) {
            mkdirp.sync(path.dirname(filePath));
        }
        fs.appendFileSync(filePath, str);
    }
}
