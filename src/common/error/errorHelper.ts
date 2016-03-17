// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import {InternalError, NestedError, InternalErrorLevel} from "./internalError";
import {InternalErrorCode} from "./internalErrorCode";

export class ErrorHelper {
    private static errorStringsJsonLoc = path.resolve(__dirname, "..", "..", "..", "errorStrings", "errorStrings.json");
    public static getInternalError(errorCode: InternalErrorCode, ...optionalArgs: any[]): InternalError {
        let message = ErrorHelper.getErrorMessage(errorCode, ...optionalArgs);
        return new InternalError(<number> errorCode, message);
    }

    public static getNestedError(innerError: Error, errorCode: InternalErrorCode, ...optionalArgs: any[]): NestedError {
        let message = ErrorHelper.getErrorMessage(errorCode, ...optionalArgs);
        return new NestedError(<number> errorCode, message, innerError);
    }

    public static wrapError(error: InternalError, innerError: Error): NestedError {
        return NestedError.getWrappedError(error, innerError);
    }
    public static getWarning(message: string, ...optionalArgs: any[]): InternalError {
        return new InternalError(-1, message, InternalErrorLevel.Warning);
    }

    public static getNestedWarning(innerError: Error, message: string, ...optionalArgs: any[]): NestedError {
        return new NestedError(-1, message, innerError, null /* extras */, InternalErrorLevel.Warning);
    }

    public static loadErrorStrings(): any {
        return require(ErrorHelper.errorStringsJsonLoc);
    }

    private static getErrorMessage(errorCode: InternalErrorCode, ...optionalArgs: any[]): string {
        let errorStrings = ErrorHelper.loadErrorStrings();
        return ErrorHelper.formatErrorMessage(errorStrings[InternalErrorCode[errorCode]], ...optionalArgs);
    }

    private static formatErrorMessage(errorMessage: string, ...optionalArgs: any[]): string {
         if (!errorMessage) {
             return errorMessage;
         }

         let result: string = <string> errorMessage;
         let args: string[] = ErrorHelper.getOptionalArgsArrayFromFunctionCall(arguments, 1);
         if (args) {
            for (var i: number = 0; i < args.length; i++) {
                result = result.replace(new RegExp("\\{" + i + "\\}", "g"), args[i]);
            }
         }

         return result;
    }

    private static getOptionalArgsArrayFromFunctionCall(functionArguments: IArguments, startIndex: number): any[] {
        if (functionArguments.length <= startIndex) {
            return null;
        }

        if (Array.isArray(functionArguments[startIndex])) {
            return functionArguments[startIndex];
        }

        return Array.prototype.slice.apply(functionArguments, [startIndex]);
    }
}
