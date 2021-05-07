// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { DeviceType } from "../../launchArgs";
import { ClientOS } from "../clientUtils";
import { BaseClientDevice } from "./baseClientDevice";

export class IOSClienDevice extends BaseClientDevice {
    private _state: string;

    constructor(id: string, deviceType: DeviceType, os: ClientOS, state: string, name?: string) {
        super(id, deviceType, os, name);
        this._state = state;
    }

    get state(): string {
        return this._state;
    }

    set state(state: string) {
        this._state = state;
    }
}
