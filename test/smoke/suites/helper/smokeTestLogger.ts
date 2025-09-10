// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import * as colors from "ansi-colors";

export class SmokeTestLogger {
    public static log(...str: string[]): void {
        console.log(colors.white(`[Log] ${str.join(" ")}`));
    }

    public static info(...str: string[]): void {
        console.log(colors.blue(`[Info] ${str.join(" ")}`));
    }

    public static warn(...str: string[]): void {
        console.log(colors.yellow(`[Warning] ${str.join(" ")}`));
    }

    public static testLog(...str: string[]): void {
        console.log(colors.white(`[TestLog] ${str.join(" ")}`));
    }

    public static success(...str: string[]): void {
        console.log(colors.green(`[Success] ${str.join(" ")}`));
    }

    public static projectInstallLog(...str: string[]): void {
        console.log(colors.bgCyan(str.join(" ")));
    }

    public static projectPatchingLog(...str: string[]): void {
        console.log(colors.bgMagenta(str.join(" ")));
    }

    public static error(err: string | Error): void {
        console.error(colors.red(err.toString()));
    }

    public static saveLogsInFile(str: string, filePath: string): void {
        if (!fs.existsSync(filePath)) {
            mkdirp.sync(path.dirname(filePath));
        }
        fs.appendFileSync(filePath, str);
    }
}
