// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import ansiСolors = require("ansi-colors");

export class SmokeTestLogger {

    private static colorize(str: string, color: ansiСolors.StyleType) {
        return `${color.open}${str}${ansiСolors.styles.reset.open}`;
    }

    public static log(...str: string[]) {
        console.log(...str);
    }
    public static info(...str: string[]) {
        console.log(SmokeTestLogger.colorize(str.join(" "), ansiСolors.styles.blue));
    }
    public static warn(...str: string[]) {
        console.log(SmokeTestLogger.colorize(str.join(" "), ansiСolors.styles.yellow));
    }
    public static success(...str: string[]) {
        console.log(SmokeTestLogger.colorize(str.join(" "), ansiСolors.styles.green));
    }
    public static projectInstallLog(...str: string[]) {
        console.log(SmokeTestLogger.colorize(str.join(" "), ansiСolors.styles.cyanBright));
    }
    public static projectPatchingLog(...str: string[]) {
        console.log(SmokeTestLogger.colorize(str.join(" "), ansiСolors.styles.magenta));
    }
    public static error(err: string | Error) {
        console.error(SmokeTestLogger.colorize(err.toString(), ansiСolors.styles.red));
    }
    public static saveLogsInFile(str: string, filePath: string) {
        if (!fs.existsSync(filePath)) {
            mkdirp.sync(path.dirname(filePath));
        }
        fs.appendFileSync(filePath, str);
    }
}
