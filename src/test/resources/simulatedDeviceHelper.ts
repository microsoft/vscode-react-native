import * as Q from "q";

import * as deviceHelper from "../../common/android/deviceHelper";

import {FileSystem} from "../../common/node/fileSystem";
import {SimulatedAndroidAPK} from "./simulatedAndroidAPK";

export type IDevice = deviceHelper.IDevice;

interface IDeviceStateMapping {
    [deviceId: string]: IDeviceState;
}

interface IDeviceState {
    isOnline: boolean;
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

/* Simulation of DeviceHelper/ADB */
export class SimulatedDeviceHelper implements deviceHelper.IDeviceHelper {
    private connectedDevices: IDeviceStateMapping = {};
    private fileSystem: FileSystem;

    constructor(fileSystem: FileSystem) {
        this.fileSystem = fileSystem;
    }

    public getConnectedDevices(): Q.Promise<IDevice[]> {
        return Q.resolve(this.getDevicesIds().map(deviceId => {
            return { id: deviceId, isOnline: this.connectedDevices[deviceId].isOnline };
        }));
    }

    public reloadAppInDebugMode(projectRoot: string, packageName: string, debugTarget?: string): Q.Promise<void> {
        const runningApplicationState = this.getRunningAppOrNull(packageName, debugTarget);
        if (runningApplicationState) {
            runningApplicationState.isInDebugMode = true;
            return Q.resolve<void>(void 0);
        } else {
            throw new Error("Implement proper adb response: Application is not running");
        }
    }

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

    public installApp(apkPath: string, debugTarget?: string): Q.Promise<void> {
        const deviceState = this.getOnlineDeviceById(debugTarget);
        return new SimulatedAndroidAPK(this.fileSystem).readPackageNameFromFile(apkPath).then(packageName => {
            deviceState.installedApplications[packageName] = {};
        });
    }

    public isAppRunning(packageName: string, debugTarget?: string): Q.Promise<boolean> {
        return Q.resolve(this.isAppRunningSync(packageName, debugTarget));
    }

    public findDevicesRunningApp(packageName: string): Q.Promise<string[]> {
        return Q.resolve(this.getOnlineDevicesIds().filter(deviceId =>
            this.isAppRunningSync(packageName, deviceId)));
    }

    public isDeviceOnline(deviceId: string): Q.Promise<boolean> {
        return Q.resolve(this.isDeviceOnlineSync(deviceId));
    }

    // We get notified that a device was connected
    public notifyDeviceWasConnected(deviceId: string): void {
        if (this.connectedDevices[deviceId]) {
            throw new Error(`Device ${deviceId} was already connected to simulated ADB`);
        } else {
            this.connectedDevices[deviceId] = { isOnline: true, installedApplications: {}, runningApplications: {} };
        }
    }

    // We get notified that a device went offline
    public notifyDevicesAreOffline(...deviceIds: string[]): void {
        deviceIds.forEach(deviceId => {
            return this.notifyDeviceIsOffline(deviceId);
        });
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
