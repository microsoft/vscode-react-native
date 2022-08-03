// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ClientOS } from "../clientUtils";
import { BaseClientDevice } from "./baseClientDevice";

export class IOSClienDevice extends BaseClientDevice {
    private _isOnline: boolean;

    constructor(
        id: string,
        isVirtualTarget: boolean,
        os: ClientOS,
        isOnline: boolean,
        name?: string,
    ) {
        super(id, isVirtualTarget, os, name);
        this._isOnline = isOnline;
    }

    get isOnline(): boolean {
        return this._isOnline;
    }

    set isOnline(isOnline: boolean) {
        this._isOnline = isOnline;
    }
}
