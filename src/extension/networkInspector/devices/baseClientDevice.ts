// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IDebuggableMobileTarget } from "../../mobileTarget";
import { ClientOS } from "../clientUtils";

export enum DeviceStatus {
    Prepared,
    NotPrepared,
}

export class BaseClientDevice implements IDebuggableMobileTarget {
    // operating system of this device
    protected _os: ClientOS;
    // human readable name for this device
    protected _name?: string;
    // type of this device
    protected _isVirtualTarget: boolean;
    // serial number for this device
    protected _id: string;
    protected _deviceStatus: DeviceStatus;

    constructor(id: string, isVirtualTarget: boolean, os: ClientOS, name?: string) {
        this._id = id;
        this._name = name;
        this._isVirtualTarget = isVirtualTarget;
        this._os = os;
        this._deviceStatus = DeviceStatus.NotPrepared;
    }

    get id(): string {
        return this._id;
    }

    get os(): ClientOS {
        return this._os;
    }

    get name(): string | undefined {
        return this._name;
    }

    get isVirtualTarget(): boolean {
        return this._isVirtualTarget;
    }

    get isOnline(): boolean {
        return true;
    }

    get deviceStatus(): DeviceStatus {
        return this._deviceStatus;
    }

    set deviceStatus(deviceStatus: DeviceStatus) {
        this._deviceStatus = deviceStatus;
    }
}
