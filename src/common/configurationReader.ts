// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {InternalErrorCode} from "./error/internalErrorCode";
import {ErrorHelper} from "./error/errorHelper";

export class ConfigurationReader {
    /* We try to read an integer. It can be either an integer, or a string that can be parsed as an integer */
    public static readInt(value: any): number {
        if (this.isInt(value)) {
            return value;
        } else if (typeof value === "string") {
            return parseInt(value, 10);
        } else {
            throw ErrorHelper.getInternalError(InternalErrorCode.ExpectedIntegerValue, value);
        }
    }

    /* We try to read an integer. If it's a falsable value we return the default value, if not we behave like this.readInt(value)
      If the value is provided but it can't be parsed we'll throw an exception so the user knows that we didn't understand
      the value that was provided */
    public static readIntWithDefaultSync(value: any, defaultValue: number): number {
            return value ? this.readInt(value) : defaultValue;
    }

    public static readIntWithDefaultAsync(value: any, defaultValuePromise: Q.Promise<number>): Q.Promise<number> {
        return defaultValuePromise.then(defaultValue => {
            return this.readIntWithDefaultSync(value, defaultValue);
        });
    }

    private static isInt(value: any): boolean {
        return this.isNumber(value) && value % 1 === 0;
    }

    private static isNumber(value: any): boolean {
        return typeof value === "number";
    }
}