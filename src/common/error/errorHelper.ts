// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { InternalError, NestedError, InternalErrorLevel } from "./internalError";
import { InternalErrorCode } from "./internalErrorCode";
import { ERROR_STRINGS } from "./errorStrings";

export class ErrorHelper {
    public static ERROR_STRINGS = ERROR_STRINGS;
    public static getInternalError(
        errorCode: InternalErrorCode,
        ...optionalArgs: any[]
    ): InternalError {
        const message = ErrorHelper.getErrorMessage(errorCode, ...optionalArgs);
        return new InternalError(<number>errorCode, message);
    }

    public static getNestedError(
        innerError: Error,
        errorCode: InternalErrorCode,
        ...optionalArgs: any[]
    ): NestedError {
        const message = ErrorHelper.getErrorMessage(errorCode, ...optionalArgs);
        return new NestedError(<number>errorCode, message, innerError);
    }

    public static wrapError(error: InternalError, innerError: Error): NestedError {
        return NestedError.getWrappedError(error, innerError);
    }

    public static getWarning(message: string): InternalError {
        return new InternalError(-1, message, InternalErrorLevel.Warning);
    }

    public static getNestedWarning(innerError: Error, message: string): NestedError {
        return new NestedError(
            -1,
            message,
            innerError,
            null /* extras */,
            InternalErrorLevel.Warning,
        );
    }

    private static getErrorMessage(errorCode: InternalErrorCode, ...optionalArgs: any[]): string {
        return ErrorHelper.formatErrorMessage(
            ErrorHelper.ERROR_STRINGS[errorCode],
            ...optionalArgs,
        );
    }

    private static formatErrorMessage(errorMessage: string, ...optionalArgs: any[]): string {
        if (!errorMessage) {
            return errorMessage;
        }

        let result: string = <string>errorMessage;
        for (const [i, optionalArg] of optionalArgs.entries()) {
            result = result.replace(new RegExp("\\{" + i + "\\}", "g"), optionalArg);
        }

        return result;
    }
}
