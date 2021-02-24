// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { DeviceType } from "../../launchArgs";
import { ClientOS } from "../clientUtils";
import { IVirtualDevice } from "../../VirtualDeviceManager";

export enum DeviceStatus {
    Prepared,
    NotPrepared,
}

export class BaseClientDevice implements IVirtualDevice {
    // operating system of this device
    private _os: ClientOS;
    // human readable name for this device
    private _name?: string;
    // type of this device
    private _deviceType: DeviceType;
    // serial number for this device
    private _id: string;
    private _deviceStatus: DeviceStatus;

    constructor(id: string, deviceType: DeviceType, os: ClientOS, name?: string) {
        this._id = id;
        this._name = name;
        this._deviceType = deviceType;
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

    get deviceType(): DeviceType {
        return this._deviceType;
    }

    get deviceStatus(): DeviceStatus {
        return this._deviceStatus;
    }

    set deviceStatus(deviceStatus: DeviceStatus) {
        this._deviceStatus = deviceStatus;
    }
}
