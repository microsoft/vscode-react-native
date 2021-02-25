// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AdbDeviceType, AdbHelper } from "./adb";
import { DeviceStorage } from "../networkInspector/devices/deviceStorage";
import { AndroidClientDevice } from "../networkInspector/devices/androidClientDevice";
import { NetworkInspectorServer } from "../networkInspector/networkInspectorServer";
import { DeviceStatus } from "../networkInspector/devices/baseClientDevice";
import { AbstractDeviceTracker } from "../abstractDeviceTracker";

export class AndroidDeviceTracker extends AbstractDeviceTracker {
    private adbHelper: AdbHelper;

    constructor(adbHelper: AdbHelper) {
        super();
        this.adbHelper = adbHelper;
    }

    public async start(): Promise<void> {
        this.logger.debug("Start Android device tracker");
        await this.queryDevicesLoop();
    }

    public stop(): void {
        this.logger.debug("Stop Android device tracker");
        this.isStop = true;
    }

    protected async queryDevices(): Promise<void> {
        const onlineDevices = await this.adbHelper.getOnlineDevices();
        let currentDevicesIds = new Set(
            [...DeviceStorage.devices.keys()].filter(
                key => DeviceStorage.devices.get(key) instanceof AndroidClientDevice,
            ),
        );

        for (const onlineDevice of onlineDevices) {
            if (currentDevicesIds.has(onlineDevice.id)) {
                currentDevicesIds.delete(onlineDevice.id);
            } else {
                const androidDevice = new AndroidClientDevice(
                    onlineDevice.id,
                    onlineDevice.type === AdbDeviceType.AndroidSdkEmulator ? "simulator" : "device",
                    "Android",
                );
                await this.initAndroidDevice(androidDevice);
                DeviceStorage.devices.set(androidDevice.id, androidDevice);
            }
        }

        currentDevicesIds.forEach(oldDeviceId => {
            DeviceStorage.devices.delete(oldDeviceId);
        });
    }

    private async initAndroidDevice(androidDevice: AndroidClientDevice) {
        await this.adbHelper.reverseAdb(
            androidDevice.id,
            NetworkInspectorServer.InsecureServerPort,
        );
        await this.adbHelper.reverseAdb(androidDevice.id, NetworkInspectorServer.SecureServerPort);
        androidDevice.deviceStatus = DeviceStatus.Prepared;
    }
}
