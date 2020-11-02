// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import colors = require("colors");

export class ConsoleLogger {
    public static log(...str: string[]) {
        console.log(...str);
    }
    public static info(...str: string[]) {
        console.log(colors.blue(str.join(" ")));
    }
    public static warn(...str: string[]) {
        console.log(colors.yellow(str.join(" ")));
    }
    public static success(...str: string[]) {
        console.log(colors.green(str.join(" ")));
    }
    public static error(err: string | Error) {
        console.error(colors.red(err.toString()));
    }
}
