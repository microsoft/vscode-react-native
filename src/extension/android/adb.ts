// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {ChildProcess} from "../../common/node/childProcess";
import {CommandExecutor} from "../../common/commandExecutor";

// See android versions usage at: http://developer.android.com/about/dashboards/index.html
export enum AndroidAPILevel {
    Marshmallow = 23,
    LOLLIPOP_MR1 = 22,
    LOLLIPOP = 21, /* Supports adb reverse */
    KITKAT = 19,
    JELLY_BEAN_MR2 = 18,
    JELLY_BEAN_MR1 = 17,
    JELLY_BEAN = 16,
    ICE_CREAM_SANDWICH_MR1 = 15,
    GINGERBREAD_MR1 = 10,
}

enum KeyEvents {
    KEYCODE_BACK = 4,
    KEYCODE_DPAD_UP = 19,
    KEYCODE_DPAD_DOWN = 20,
    KEYCODE_DPAD_CENTER = 23,
    KEYCODE_MENU = 82,
}

export enum DeviceType {
    AndroidSdkEmulator, // These seem to have emulator-<port> ids
    Other,
}

export interface IDevice {
    id: string;
    isOnline: boolean;
    type: DeviceType;
}

const AndroidSDKEmulatorPattern = /^emulator-\d{1,5}$/;

export class AdbHelper {
    private static childProcess: ChildProcess = new ChildProcess();
    private static commandExecutor: CommandExecutor = new CommandExecutor();

    /**
     * Gets the list of Android connected devices and emulators.
     */
    public static getConnectedDevices(): Q.Promise<IDevice[]> {
        return this.childProcess.execToString("adb devices")
            .then(output => {
                return this.parseConnectedDevices(output);
            });
    }

    /**
     * Broadcasts an intent to reload the application in debug mode.
     */
    public static switchDebugMode(projectRoot: string, packageName: string, enable: boolean, debugTarget?: string): Q.Promise<void> {
        let enableDebugCommand = `adb ${debugTarget ? "-s " + debugTarget : ""} shell am broadcast -a "${packageName}.RELOAD_APP_ACTION" --ez jsproxy ${enable}`;
        return new CommandExecutor(projectRoot).execute(enableDebugCommand)
            .then(() => { // We should stop and start application again after RELOAD_APP_ACTION, otherwise app going to hangs up
                let deferred = Q.defer();
                setTimeout(() => {
                    this.stopApp(projectRoot, packageName, debugTarget)
                        .then(() => {
                            return deferred.resolve({});
                        });
                }, 200); // We need a little delay after broadcast command

                return deferred.promise;
            })
            .then(() => {
                return this.launchApp(projectRoot, packageName, debugTarget);
            });
    }

    /**
     * Sends an intent which launches the main activity of the application.
     */
    public static launchApp(projectRoot: string, packageName: string, debugTarget?: string): Q.Promise<void> {
        let launchAppCommand = `adb ${debugTarget ? "-s " + debugTarget : ""} shell am start -n ${packageName}/.MainActivity`;
        return new CommandExecutor(projectRoot).execute(launchAppCommand);
    }

    public static stopApp(projectRoot: string, packageName: string, debugTarget?: string): Q.Promise<void> {
        let stopAppCommand = `adb ${debugTarget ? "-s " + debugTarget : ""} shell am force-stop ${packageName}`;
        return new CommandExecutor(projectRoot).execute(stopAppCommand);
    }

    public static apiVersion(deviceId: string): Q.Promise<AndroidAPILevel> {
        return this.executeQuery(deviceId, "shell getprop ro.build.version.sdk").then(output =>
            parseInt(output, 10));
    }

    public static reverseAdb(deviceId: string, packagerPort: number): Q.Promise<void> {
        return this.execute(deviceId, `reverse tcp:${packagerPort} tcp:${packagerPort}`);
    }

    public static showDevMenu(deviceId?: string): Q.Promise<void> {
        let command = `adb ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_MENU}`;
        return this.commandExecutor.execute(command);
    }

    public static reloadApp(deviceId?: string): Q.Promise<void> {
        let commands = [
            `adb ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_MENU}`,
            `adb ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_DPAD_UP}`,
            `adb ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_DPAD_CENTER}`,
        ];

        return this.executeChain(commands);
    }

    public static getOnlineDevices(): Q.Promise<IDevice[]> {
        return this.getConnectedDevices().then(devices => {
            return devices.filter(device =>
                device.isOnline);
        });
    }

    private static parseConnectedDevices(input: string): IDevice[] {
        let result: IDevice[] = [];
        let regex = new RegExp("^(\\S+)\\t(\\S+)$", "mg");
        let match = regex.exec(input);
        while (match != null) {
            result.push({ id: match[1], isOnline: match[2] === "device", type: this.extractDeviceType(match[1]) });
            match = regex.exec(input);
        }
        return result;
    }

    private static extractDeviceType(id: string): DeviceType {
        return id.match(AndroidSDKEmulatorPattern)
            ? DeviceType.AndroidSdkEmulator
            : DeviceType.Other;
    }

    private static executeQuery(deviceId: string, command: string): Q.Promise<string> {
        return this.childProcess.execToString(this.generateCommandForDevice(deviceId, command));
    }

    private static execute(deviceId: string, command: string): Q.Promise<void> {
        return this.commandExecutor.execute(this.generateCommandForDevice(deviceId, command));
    }

    private static executeChain(commands: string[]): Q.Promise<any> {
        return commands.reduce((promise, command) => {
            return promise.then(() => this.commandExecutor.execute(command));
        }, Q(void 0));
    }

    private static generateCommandForDevice(deviceId: string, adbCommand: string): string {
        return `adb -s "${deviceId}" ${adbCommand}`;
    }
}
