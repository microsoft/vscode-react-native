// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as path from "path";
import stripJsonComments = require("strip-json-comments");
import { logger } from "@vscode/debugadapter";
import { ChildProcess } from "./node/childProcess";
import { HostPlatform } from "./hostPlatform";
import customRequire from "./customRequire";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const JSON5 = require("json5");

export function removeModuleFromRequireCacheByName(moduleName: string): void {
    const moduleKey = Object.keys(customRequire.cache).find(key => key.includes(moduleName));
    if (moduleKey) {
        delete customRequire.cache[moduleKey];
    }
}

export function getNodeModulesGlobalPath(): Promise<string> {
    const childProcess = new ChildProcess();
    return childProcess.execToString(`${HostPlatform.getNpmCliCommand("npm")} root -g`);
}

export function getFileNameWithoutExtension(fileName: string): string {
    return path.basename(fileName, path.extname(fileName));
}

export function isNullOrUndefined(value: any): boolean {
    return typeof value === "undefined" || value === null;
}

export function notNullOrUndefined<T>(value: T | null | undefined): value is T {
    return !isNullOrUndefined(value);
}

export function areSameDates(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

export function getRandomIntInclusive(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getFormattedTimeString(date: Date): string {
    const hourString = padZeroes(2, String(date.getUTCHours()));
    const minuteString = padZeroes(2, String(date.getUTCMinutes()));
    const secondString = padZeroes(2, String(date.getUTCSeconds()));
    return `${hourString}:${minuteString}:${secondString}`;
}

export function getFormattedDateString(date: Date): string {
    const month = date.getUTCMonth() + 1;
    return `${date.getUTCFullYear()}-${month}-${date.getUTCDate()}`;
}

export function getFormattedDatetimeString(date: Date): string {
    return `${getFormattedDateString(date)} ${getFormattedTimeString(date)}`;
}

function padZeroes(minDesiredLength: number, numberToPad: string): string {
    return numberToPad.length >= minDesiredLength
        ? numberToPad
        : String("0".repeat(minDesiredLength) + numberToPad).slice(-minDesiredLength);
}

export function stripJsonTrailingComma(str: string): any {
    const endOfStringTrailingCommaRegex = /,\s*$/g;
    const result = str.replace(endOfStringTrailingCommaRegex, "");
    let objResult;
    try {
        logger.log("Start parsing .json file...");
        objResult = JSON5.parse(result);
    } catch {
        logger.log("Failed to parse .json file. Try it again...");
        objResult = JSON.parse(stripJsonComments(str));
    }
    return objResult;
}

export async function wait(time?: number): Promise<void> {
    const times = time ? time : 2000;
    await new Promise<void>(resolve => {
        const timer = setTimeout(() => {
            clearTimeout(timer);
            resolve();
        }, times);
    });
}

export function getTimestamp(): string {
    const date = new Date(Date.now());
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const time = `${date.getDate()}${String(date.getHours()).padStart(2, "0")}${String(
        date.getMinutes(),
    ).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}`;

    return `${year}${month}${time}`;
}

export function getTSVersion(projectPath: string): Promise<string> {
    const childProcess = new ChildProcess();
    return childProcess.execToString("npx tsc -v", { cwd: projectPath });
}
