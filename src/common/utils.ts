// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export function isNullOrUndefined(value: any): boolean {
    return typeof value === "undefined" || value === null;
}

export function getFormattedTimeString(date: Date): string {
    const hourString = _padZeroes(2, String(date.getUTCHours()));
    const minuteString = _padZeroes(2, String(date.getUTCMinutes()));
    const secondString = _padZeroes(2, String(date.getUTCSeconds()));
    return `${hourString}:${minuteString}:${secondString}`;
}

export function getFormattedDateString(date: Date): string {
    return date.getUTCFullYear() + "-" + `${date.getUTCMonth() + 1}` + "-" + date.getUTCDate();
}

export function getFormattedDatetimeString(date: Date): string {
    return `${getFormattedDateString(date)} ${getFormattedTimeString(date)}`;
}

function _padZeroes(minDesiredLength: number, numberToPad: string): string {
    if (numberToPad.length >= minDesiredLength) {
        return numberToPad;
    } else {
        return String("0".repeat(minDesiredLength) + numberToPad).slice(-minDesiredLength);
    }
}
