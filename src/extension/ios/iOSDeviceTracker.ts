// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AbstractDeviceTracker } from "../abstractDeviceTracker";
import { IOSSimulatorManager, IiOSSimulator } from "./iOSSimulatorManager";
import { DeviceType } from "../launchArgs";
import iosUtil, { DeviceTarget } from "./iOSContainerUtility";
import { DeviceStorage } from "../networkInspector/devices/deviceStorage";
import { IOSClienDevice } from "../networkInspector/devices/iOSClienDevice";

export class IOSDeviceTracker extends AbstractDeviceTracker {
    private iOSSimulatorManager: IOSSimulatorManager;

    constructor() {
        super();
        this.iOSSimulatorManager = new IOSSimulatorManager();
    }

    public async start(): Promise<void> {
        this.logger.debug("Start iOS device tracker");
        await this.queryDevicesLoop();
    }

    public stop(): void {
        this.logger.debug("Stop iOS device tracker");
        this.isStop = true;
    }

    protected async queryDevices(): Promise<void> {
        const simulators = await this.getRunningSimulators();
        this.processDevices(simulators, "simulator");
        const devices = await this.getActiveDevices();
        this.processDevices(devices, "device");
    }

    private processDevices(
        activeDevices: Array<IiOSSimulator | DeviceTarget>,
        type: DeviceType,
    ): void {
        let currentDevicesIds = new Set(
            [...DeviceStorage.devices.entries()]
                .filter(entry => entry[1] instanceof IOSClienDevice && entry[1].deviceType === type)
                .map(entry => entry[0]),
        );

        for (const activeDevice of activeDevices) {
            if (currentDevicesIds.has(activeDevice.id)) {
                currentDevicesIds.delete(activeDevice.id);
            } else {
                const androidDevice = new IOSClienDevice(
                    activeDevice.id,
                    type,
                    "iOS",
                    activeDevice.state || "active",
                    activeDevice.name,
                );
                // await this.initIOSDevice(androidDevice); // prepare real iOS devices
                DeviceStorage.devices.set(androidDevice.id, androidDevice);
            }
        }

        currentDevicesIds.forEach(oldDeviceId => {
            DeviceStorage.devices.delete(oldDeviceId);
        });
    }

    private getRunningSimulators(): Promise<IiOSSimulator[]> {
        return this.iOSSimulatorManager.collectSimulators("booted");
    }

    private getActiveDevices(): Promise<Array<DeviceTarget>> {
        return iosUtil.targets().catch(e => {
            console.error(e.message);
            return [];
        });
    }
}
