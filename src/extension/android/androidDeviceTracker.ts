// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AdbDeviceType, AdbHelper } from "./adb";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { DeviceStorage } from "../networkInspector/devices/deviceStorage";
import { AndroidClientDevice } from "../networkInspector/devices/androidClientDevice";
import { NetworkInspectorServer } from "../networkInspector/networkInspectorServer";

export class AndroidDeviceTracker {
    private logger: OutputChannelLogger;
    private adbHelper: AdbHelper;
    private isStop: boolean;

    constructor(adbHelper: AdbHelper) {
        this.logger = OutputChannelLogger.getMainChannel();
        this.adbHelper = adbHelper;
        this.isStop = false;
    }

    public async start(): Promise<void> {
        this.logger.debug("Start Android device tracker");
        await this.queryDevicesLoop();
    }

    public stop(): void {
        this.logger.debug("Stop Android device tracker");
        this.isStop = true;
    }

    private async queryDevicesLoop(): Promise<void> {
        try {
            await this.queryDevices();
            if (!this.isStop) {
                // It's important to schedule the next check AFTER the current one has completed
                // to avoid simultaneous queries which can cause multiple user input prompts.
                setTimeout(() => this.queryDevicesLoop(), 3000);
            }
        } catch (err) {
            this.logger.error(err.toString());
        }
    }

    private async queryDevices(): Promise<void> {
        let onlineDevices = await this.adbHelper.getOnlineDevices();
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

                await this.adbHelper.reverseAdb(
                    androidDevice.id,
                    NetworkInspectorServer.InsecureServerPort,
                );
                await this.adbHelper.reverseAdb(
                    androidDevice.id,
                    NetworkInspectorServer.SecureServerPort,
                );
                DeviceStorage.devices.set(androidDevice.id, androidDevice);
            }
        }

        currentDevicesIds.forEach(oldDeviceId => {
            DeviceStorage.devices.delete(oldDeviceId);
        });
    }
}
