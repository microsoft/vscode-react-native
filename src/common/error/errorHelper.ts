// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {InternalError, NestedError, InternalErrorLevel, IInternalErrorArgument} from "./internalError";
import {InternalErrorCode} from "./internalErrorCode";
import {ERROR_STRINGS} from "./errorStrings";

export class ErrorHelper {
    public static ERROR_STRINGS = ERROR_STRINGS;
    public static getInternalError(errorCode: InternalErrorCode, ...optionalArgs: IInternalErrorArgument[]): InternalError {
        let args = ErrorHelper.getOptionalArgsArrayFromFunctionCall(arguments, 1);
        let message = ErrorHelper.getErrorMessage(errorCode, args);
        return new InternalError(<number> errorCode, message, InternalErrorLevel.Error, args);
    }

    public static getNestedError(innerError: Error, errorCode: InternalErrorCode, ...optionalArgs: IInternalErrorArgument[]): NestedError {
        let args = ErrorHelper.getOptionalArgsArrayFromFunctionCall(arguments, 2);
        let message = ErrorHelper.getErrorMessage(errorCode, args);
        return new NestedError(<number> errorCode, message, innerError, args);
    }

    public static wrapError(error: InternalError, innerError: Error): NestedError {
        return NestedError.getWrappedError(error, innerError);
    }
    public static getWarning(message: string, ...optionalArgs: IInternalErrorArgument[]): InternalError {
        return new InternalError(-1, message, InternalErrorLevel.Warning, []);
    }

    public static getNestedWarning(innerError: Error, message: string, ...optionalArgs: IInternalErrorArgument[]): NestedError {
        return new NestedError(-1, message, innerError, [] /* extras */, InternalErrorLevel.Warning);
    }

    private static getErrorMessage(errorCode: InternalErrorCode, optionalArgs: IInternalErrorArgument[]): string {
        return ErrorHelper.formatErrorMessage(ErrorHelper.ERROR_STRINGS[errorCode], optionalArgs);
    }

    private static formatErrorMessage(errorMessage: string, optionalArgs: IInternalErrorArgument[]): string {
         if (!errorMessage) {
             return errorMessage;
         }

         let result: string = <string> errorMessage;
         if (optionalArgs) {
            for (let i: number = 0; i < optionalArgs.length; i++) {
                result = result.replace(new RegExp("\\{" + i + "\\}", "g"), optionalArgs[i].argument);
            }
         }

         return result;
    }

    private static getOptionalArgsArrayFromFunctionCall(functionArguments: IArguments, startIndex: number): any[] {
        if (functionArguments.length <= startIndex) {
            return [];
        }

        if (Array.isArray(functionArguments[startIndex])) {
            return functionArguments[startIndex];
        }

        return Array.prototype.slice.apply(functionArguments, [startIndex]);
    }
}
