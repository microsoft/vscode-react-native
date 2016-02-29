// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as util from "util";
import * as path from "path";
import {InternalError, NestedError, InternalErrorLevel} from "./internalError";
import {InternalErrorCode} from "./internalErrorCode";

export class ErrorHelper {
    private static errorStringsJsonLoc = path.resolve(__dirname, "..", "..", "..", "errorStrings", "errorStrings.json");
    public static getInternalError(errorCode: InternalErrorCode, ...optionalArgs: any[]): InternalError {
        let message = util.format(ErrorHelper.getErrorMessage(errorCode), optionalArgs);
        return new InternalError(<number> errorCode, message);
    }

    public static getNestedError(innerError: Error, errorCode: InternalErrorCode, ...optionalArgs: any[]): NestedError {
        let message = util.format(ErrorHelper.getErrorMessage(errorCode), optionalArgs);
        return new NestedError(<number> errorCode, message, innerError);
    }

    public static wrapError(error: InternalError, innerError: Error): NestedError {
        return NestedError.getWrappedError(error, innerError);
    }
    public static getWarning(warningMessage: string, ...optionalArgs: any[]): InternalError {
        let message = util.format(warningMessage, optionalArgs);

        // Warnings do  not use error codes
        return new InternalError(-1, message, InternalErrorLevel.Warning);
    }

    private static getErrorMessage(errorCode: InternalErrorCode, ...optionalArgs: any[]): string {
        console.log(ErrorHelper.errorStringsJsonLoc);
        let errorStrings = require (ErrorHelper.errorStringsJsonLoc);
        return ErrorHelper.formatErrorMessage(errorStrings[InternalErrorCode[errorCode]], optionalArgs);
    }

    private static formatErrorMessage(errorMessage: string, ...optionalArgs: any[]): string {
            if (!errorMessage) {
                return errorMessage;
            }

            let result: string = <string> errorMessage;
            let args: string[] = Array.prototype.slice.call(arguments, 1);
            if (args) {
                for (var i: number = 0; i < args.length; i++) {
                    result = result.replace(new RegExp("\\{" + i + "\\}", "g"), args[i]);
                }
            }

            return result;
    }
}
