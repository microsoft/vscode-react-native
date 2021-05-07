// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { DeviceType } from "../../launchArgs";
import { ClientOS } from "../clientUtils";
import { BaseClientDevice } from "./baseClientDevice";

export class AndroidClientDevice extends BaseClientDevice {
    constructor(id: string, deviceType: DeviceType, os: ClientOS, name?: string) {
        super(id, deviceType, os, name);
    }
}
