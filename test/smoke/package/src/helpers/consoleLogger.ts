// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import chalk = require("chalk");

export class ConsoleLogger {
    public static log(...str: string[]) {
        console.log(...str);
    }
    public static info(...str: string[]) {
        console.log(chalk.blue(...str));
    }
    public static warn(...str: string[]) {
        console.log(chalk.yellow(...str));
    }
    public static success(...str: string[]) {
        console.log(chalk.green(...str));
    }
    public static error(err: string | Error) {
        console.error(chalk.red(err.toString()));
    }
}
