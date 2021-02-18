// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as path from "path";

export function getFileNameWithoutExtension(fileName: string): string {
    return path.basename(fileName, path.extname(fileName));
}

export function isNullOrUndefined(value: any): boolean {
    return value === "undefined" || value === null;
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

function padZeroes(minDesiredLength: number, numberToPad: string): string {
    if (numberToPad.length >= minDesiredLength) {
        return numberToPad;
    } else {
        return String("0".repeat(minDesiredLength) + numberToPad).slice(-minDesiredLength);
    }
}
