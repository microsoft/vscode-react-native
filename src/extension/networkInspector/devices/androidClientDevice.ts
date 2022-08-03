// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ClientOS } from "../clientUtils";
import { BaseClientDevice } from "./baseClientDevice";

export class AndroidClientDevice extends BaseClientDevice {
    constructor(id: string, isVirtualTarget: boolean, os: ClientOS, name?: string) {
        super(id, isVirtualTarget, os, name);
    }
}
