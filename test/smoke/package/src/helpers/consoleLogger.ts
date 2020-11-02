// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export class ConsoleLogger {
    private static colors = {
        blue: "\x1b[34m",
        yellow: "\x1b[33m",
        green: "\x1b[32m",
        red: "\x1b[31m",
    };

    private static resetMark = "\x1b[0m";

    private static colorize(str: string, color: string) {
        return `${color}${str}${ConsoleLogger.resetMark}`;
    }

    public static log(...str: string[]) {
        console.log(...str);
    }
    public static info(...str: string[]) {
        console.log(ConsoleLogger.colorize(str.join(" "), ConsoleLogger.colors.blue));
    }
    public static warn(...str: string[]) {
        console.log(ConsoleLogger.colorize(str.join(" "), ConsoleLogger.colors.yellow));
    }
    public static success(...str: string[]) {
        console.log(ConsoleLogger.colorize(str.join(" "), ConsoleLogger.colors.green));
    }
    public static error(err: string | Error) {
        console.error(ConsoleLogger.colorize(err.toString(), ConsoleLogger.colors.red));
    }
}
