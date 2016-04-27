// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {DeviceType} from "../../../common/android/adb";
import {Adb} from "./adb";

export interface IAVDManager {
    // Intends to simulate: android create avd -n <name> -t <targetID> [-<option> <value>] ...
    create(avdId: string): Q.Promise<void>;
    // Intends to simulate: emulator -avd WVGA800 -scale 96dpi -dpi-device 160
    launch(avdId: string): Q.Promise<string>;
    createAndLaunch(avdId: string): Q.Promise<string>;
    createAndLaunchAll(avdIds: string[]): Q.Promise<string[]>;
}

interface IDeviceStateMapping {
    [avdId: string]: any;
}

/* Simulation of AVD Manager. */
export class AVDManager implements IAVDManager {
    private nextAvailablePort = 5555;

    private devices: IDeviceStateMapping = {};

    constructor(private adb: Adb) {}

    public createAndLaunch(avdId: string): Q.Promise<string> {
        return this.create(avdId).then(() =>
            this.launch(avdId));
    }

    // Intends to simulate: android create avd -n <name> -t <targetID> [-<option> <value>] ...
    public create(avdId: string): Q.Promise<void> {
        if (!this.devices[avdId]) {
            this.devices[avdId] = {};
            return Q.resolve<void>(void 0);
        } else {
            throw new Error("Implement to match AVD: Device already exists");
        }
    }

    // Intends to simulate: emulator -avd WVGA800 -scale 96dpi -dpi-device 160
    public launch(avdId: string): Q.Promise<string> {
        if (this.devices[avdId]) {
            this.adb.notifyDeviceWasConnected(avdId, DeviceType.AndroidSdkEmulator);
            return Q(`emulator-${this.nextAvailablePort++}`);
        } else {
            throw new Error("Implement to match AVD: Device doesn't exists");
        }
   }

   public createAndLaunchAll(avdIds: string[]): Q.Promise<string[]> {
        return Q.all(avdIds.map(avdId => this.createAndLaunch(avdId)));
   }
}