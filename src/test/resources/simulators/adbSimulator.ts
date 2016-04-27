// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import * as adb from "../../../common/android/adb";

import {FileSystem} from "../../../common/node/fileSystem";
import {APKSerializer} from "./apkSerializer";

export type IDevice = adb.IDevice;

interface IDeviceStateMapping {
    [deviceId: string]: IDeviceState;
}

interface IDeviceState {
    isOnline: boolean;
    type: adb.DeviceType;
    installedApplications: IInstalledApplicationStateMapping;
    runningApplications: IRunningApplicationStateMapping;
}

interface IInstalledApplicationStateMapping {
    [applicationName: string]: IInstalledApplicationState;
}

interface IInstalledApplicationState {
}

interface IRunningApplicationStateMapping {
    [applicationName: string]: IRunningApplicationState;
}

interface IRunningApplicationState {
    isInDebugMode: boolean;
}

/* Simulation of adb/ADB */
export class AdbSimulator extends adb.AdbEnhancements {
    private connectedDevices: IDeviceStateMapping = {};
    private fileSystem: FileSystem;

    constructor(fileSystem: FileSystem) {
        super();
        this.fileSystem = fileSystem;
    }

    // Intends to simulate: adb devices
    public getConnectedDevices(): Q.Promise<IDevice[]> {
        return Q.resolve(this.getDevicesIds().map(deviceId => {
            const device = this.connectedDevices[deviceId];
            return { id: deviceId, isOnline: device.isOnline, type: device.type };
        }));
    }

    // Intends to simulate: the react-native application running
    // TODO: We should move the react-native specific part of this method to another class
    public reloadAppInDebugMode(projectRoot: string, packageName: string, debugTarget?: string): Q.Promise<void> {
        const runningApplicationState = this.getRunningAppOrNull(packageName, debugTarget);
        if (runningApplicationState) {
            runningApplicationState.isInDebugMode = true;
            return Q.resolve<void>(void 0);
        } else {
            throw new Error("Implement proper adb response: Application is not running");
        }
    }

    // Intends to simulate: adb shell am start
    public launchApp(projectRoot: string, packageName: string, debugTarget?: string): Q.Promise<void> {
        const deviceState = this.getOnlineDeviceById(debugTarget);
        const installedApplicationState = deviceState.installedApplications[packageName];
        if (installedApplicationState) {
            deviceState.runningApplications[packageName] = { isInDebugMode: false };
            return Q.resolve<void>(void 0);
        } else {
            throw new Error("Implement proper adb response: Application doesn't exist");
        }
    }

    // Intends to simulate: adb install
    public installApp(apkPath: string, debugTarget?: string): Q.Promise<void> {
        const deviceState = this.getOnlineDeviceById(debugTarget);
        return new APKSerializer(this.fileSystem).readPackageNameFromFile(apkPath).then(packageName => {
            deviceState.installedApplications[packageName] = {};
        });
    }

    // Intends to simulate: adb shell ps | grep <packageName> | awk '{print $9}'
    public isAppRunning(packageName: string, debugTarget?: string): Q.Promise<boolean> {
        return Q.resolve(this.isAppRunningSync(packageName, debugTarget));
    }

    // Intends to simulate: combination of this.getConnectedDevices() and this.isAppRunning()
    public findDevicesRunningApp(packageName: string): Q.Promise<string[]> {
        return Q.resolve(this.getOnlineDevicesIds().filter(deviceId =>
            this.isAppRunningSync(packageName, deviceId)));
    }

    // Intends to simulate: <adb devices> second column
    public isDeviceOnline(deviceId: string): Q.Promise<boolean> {
        return Q.resolve(this.isDeviceOnlineSync(deviceId));
    }

    // We get notified that a device was connected. Intends to simulate connecting a device to the Computer
    public notifyDeviceWasConnected(deviceId: string, deviceType: adb.DeviceType): void {
        if (this.connectedDevices[deviceId]) {
            throw new Error(`Device ${deviceId} was already connected to simulated ADB`);
        } else {
            this.connectedDevices[deviceId] = { isOnline: true, installedApplications: {}, runningApplications: {}, type: deviceType };
        }
    }

    // We get notified that a device went offline. TODO: Find out how can this happen for real
    public notifyDevicesAreOffline(deviceIds: string[]): void {
        deviceIds.forEach(deviceId => {
            return this.notifyDeviceIsOffline(deviceId);
        });
    }

    public apiVersion(deviceId: string): Q.Promise<adb.AndroidAPILevel> {
        throw new Error("Not yet implemented: Implement if we need to use these methods in a test");
    }

    public reverseAdd(deviceId: string, devicePort: string, computerPort: string): Q.Promise<void> {
        throw new Error("Not yet implemented: Implement if we need to use these methods in a test");
    }

    private isAppRunningSync(packageName: string, debugTarget?: string): boolean {
        return this.getRunningAppOrNull(packageName, debugTarget) != null;
    }

    private notifyDeviceIsOffline(deviceId: string): void {
        this.getOnlineDeviceById(deviceId).isOnline = false;
    }

    private getRunningAppOrNull(packageName: string, debugTarget?: string): IRunningApplicationState {
        return this.getOnlineDeviceById(debugTarget).runningApplications[packageName];
    }

    private getOnlineDeviceById(deviceId?: string): IDeviceState {
        const deviceState = this.getDeviceById(deviceId);
        if (deviceState.isOnline) {
            return deviceState;
        } else {
            throw new Error("Implement proper adb response: Target device isn't online");
        }
    }

    private getDeviceById(deviceId?: string): IDeviceState {
        if (deviceId) { // If the deviceId is specified, we search for that device
            const deviceState = this.connectedDevices[deviceId];
            if (deviceState) { // If it exists, we return it
                return deviceState;
            } else { // If not we fail
                throw new Error("Implement proper adb response: Target device doesn't exist");
            }
        } else {
            const devicesIds = this.getDevicesIds();
            if (devicesIds.length === 1) { // If deviceId is null and we have a single device, we return that device
                return this.connectedDevices[devicesIds[0]];
            } else if (devicesIds.length > 1) {
                throw new Error("error: more than one device/emulator"); // error code = 1
            } else {
                throw new Error("error: no devices found"); // error code = 1
            }
        }
    }

    private getDevicesIds(): string[] {
        return Object.keys(this.connectedDevices);
    }

    private getOnlineDevicesIds(): string[] {
        return this.getDevicesIds().filter(deviceId =>
            this.isDeviceOnlineSync(deviceId));
    }

    private isDeviceOnlineSync(deviceId: string): boolean {
        return this.getDeviceById(deviceId).isOnline;
    }
}
