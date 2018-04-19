// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export type CommandResult = CommandSucceededResult | CommandFailedResult;

export interface CommandSucceededResult {
    succeeded: boolean;
    result?: any;
}

export interface CommandFailedResult {
    succeeded: boolean;
    errorCode: number;
    errorMessage: string;
    exception?: Error;
}

export function success(res: any): CommandResult {
    return {
        succeeded: true,
        result: res,
    };
  }

// Used when there's a failure otherwise
export function failure(errorCode: number, errorMessage: string): CommandResult {
    return {
        succeeded: false,
        errorCode,
        errorMessage,
    };
}

export enum ErrorCodes {
    Succeeded = 0,
    // Command given contained illegal characters/names
    IllegalCommand,
    // Command was legal, but not found
    NoSuchCommand,
    // Unhandled exception occurred
    Exception,
    // A parameter is invalid
    InvalidParameter,
    // Command requires logged in user
    NotLoggedIn,
    // The requested resource was not found
    NotFound,
  }