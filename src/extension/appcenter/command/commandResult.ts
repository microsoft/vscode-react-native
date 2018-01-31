// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export type CommandResult = CommandSucceededResult | CommandFailedResult;

export interface CommandSucceededResult {
    // Nothing to say here, it just works. :-)
    succeeded: boolean;
}

export interface CommandFailedResult {
    succeeded: boolean;
    errorCode: number;
    errorMessage: string;
    exception?: Error;
}
