// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export interface ITarget {
    name?: string;
    id?: string;
    isVirtualTarget: boolean;
}

export interface IMobileTarget extends ITarget {
    isOnline: boolean;
}

export interface IDebuggableMobileTarget extends IMobileTarget {
    id: string;
}

export class MobileTarget implements IDebuggableMobileTarget {
    protected _name?: string;
    protected _id: string;
    protected _isOnline: boolean;
    protected _isVirtualTarget: boolean;

    constructor(isOnline: boolean, isVirtualTarget: boolean, id: string, name?: string) {
        this._isOnline = isOnline;
        this._isVirtualTarget = isVirtualTarget;
        this._name = name;
        this._id = id;
    }

    get name(): string | undefined {
        return this._name;
    }

    set name(value: string | undefined) {
        this._name = value;
    }

    get id(): string {
        return this._id;
    }

    set id(id: string) {
        this._id = id;
    }

    get isOnline(): boolean {
        return this._isOnline;
    }

    set isOnline(value: boolean) {
        this._isOnline = value;
    }

    get isVirtualTarget(): boolean {
        return this._isVirtualTarget;
    }
}
