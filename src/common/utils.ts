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

export function getFormattedTimeString(date: Date): string {
    const hourString = padZeroes(2, String(date.getUTCHours()));
    const minuteString = padZeroes(2, String(date.getUTCMinutes()));
    const secondString = padZeroes(2, String(date.getUTCSeconds()));
    return `${hourString}:${minuteString}:${secondString}`;
}

export function getFormattedDateString(date: Date): string {
    return date.getUTCFullYear() + "-" + `${date.getUTCMonth() + 1}` + "-" + date.getUTCDate();
}

export function getFormattedDatetimeString(date: Date): string {
    return `${getFormattedDateString(date)} ${getFormattedTimeString(date)}`;
}

export function waitUntil<T>(
    condition: () => Promise<T | null> | T | null,
    interval: number = 1000,
    timeout?: number,
): Promise<T | null> {
    return new Promise(resolve => {
        let rejectTimeout: NodeJS.Timeout | undefined;
        if (timeout) {
            rejectTimeout = setTimeout(() => {
                cleanup();
                resolve(null);
            }, timeout);
        }

        const сheckInterval = setInterval(async () => {
            const result = await condition();
            if (result) {
                cleanup();
                resolve(result);
            }
        }, interval);

        const cleanup = () => {
            if (rejectTimeout) {
                clearTimeout(rejectTimeout);
            }
            clearInterval(сheckInterval);
        };
    });
}

function padZeroes(minDesiredLength: number, numberToPad: string): string {
    if (numberToPad.length >= minDesiredLength) {
        return numberToPad;
    } else {
        return String("0".repeat(minDesiredLength) + numberToPad).slice(-minDesiredLength);
    }
}
