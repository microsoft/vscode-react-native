// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export enum InternalErrorLevel {
    Error,
    Warning,
}

export class InternalError extends Error {
    public errorCode: number;
    public errorLevel: InternalErrorLevel;

    public get isInternalError(): boolean {
        return true;
    }

    constructor(
        errorCode: number,
        message: string,
        errorLevel: InternalErrorLevel = InternalErrorLevel.Error,
    ) {
        super(message);
        this.errorCode = errorCode;
        this.errorLevel = errorLevel;
        this.message = errorCode > 0 ? `${message} (error code ${this.errorCode})` : message;
    }
}

export class NestedError extends InternalError {
    public innerError: Error | any; // Normally this should be an error, but we support any value
    private _extras: any;

    constructor(
        errorCode: number,
        message: string,
        innerError: any = null,
        extras?: any,
        errorLevel: InternalErrorLevel = InternalErrorLevel.Error,
    ) {
        super(errorCode, message, errorLevel);
        this.innerError = innerError;
        this.name = innerError ? innerError.name : null;
        const innerMessage = innerError ? innerError.message : null;
        this.message = innerMessage ? `${message}: ${String(innerMessage)}` : message;
        this._extras = extras;
    }

    public get extras(): any {
        return this._extras;
    }

    public static getWrappedError(error: InternalError, innerError: any): NestedError {
        return new NestedError(innerError.errorCode || error.errorCode, error.message, innerError);
    }
}
