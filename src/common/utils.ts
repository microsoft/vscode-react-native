// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as path from "path";
import { ChildProcess } from "./node/childProcess";
import { HostPlatform } from "./hostPlatform";
import customRequire from "./customRequire";

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
