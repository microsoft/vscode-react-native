// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { BaseClientDevice } from "./baseClientDevice";

export class DeviceStorage {
    public static readonly devices: Map<string, BaseClientDevice> = new Map<
        string,
        BaseClientDevice
    >();
}
