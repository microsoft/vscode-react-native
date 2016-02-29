// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export class InternalError extends Error {
    public errorCode: number;

    constructor(errorCode: number, message: string) {
        super(message);
        this.errorCode = errorCode;
        this.message = message;
    }
}

export class NestedError extends InternalError {
    public innerError: Error | any; // Normally this should be an error, but we support any value

    constructor(errorCode: number, message: string, innerError: any) {
        super(errorCode, message);
        this.innerError = innerError;
        this.name = innerError ? innerError.name : null;
        const innerMessage = innerError ? innerError.message : null;
        this.message = innerMessage ? `${message}: ${innerMessage}` : message;
    }
}