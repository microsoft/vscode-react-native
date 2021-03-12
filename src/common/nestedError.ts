// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export class NestedError extends Error {
    private _innerError: Error | any; // Normally this should be an error, but we support any value
    private _extras: any;

    constructor(message: string, innerError: any, extras?: any) {
        super(message);
        this._innerError = innerError;
        this.name = innerError.name;
        const innerMessage = this._innerError.message;
        this.message = innerMessage ? `${message}: ${innerMessage}` : message;
        this._extras = extras;
    }

    public get extras(): any {
        return this._extras;
    }
}
