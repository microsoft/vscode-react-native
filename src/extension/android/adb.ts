// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import { ChildProcess, ISpawnResult } from "../../common/node/childProcess";
import {CommandExecutor} from "../../common/commandExecutor";
import * as path from "path";
import { FileSystem } from "../../common/node/fileSystem";
import { ILogger } from "../log/LogHelper";
const fs = new FileSystem();

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
    private childProcess: ChildProcess = new ChildProcess();
    private commandExecutor: CommandExecutor = new CommandExecutor();
    private adbExecutable: string = "";

    constructor(projectRoot: string, logger: ILogger) {

        // Trying to read sdk location from local.properties file and if we succueded then
        // we would run adb from inside it, otherwise we would rely to PATH
        const sdkLocation = this.getSdkLocationFromLocalPropertiesFile(projectRoot, logger);
        this.adbExecutable = sdkLocation ? `${path.join(sdkLocation, "platform-tools", "adb")}` : "adb";
    }

    /**
     * Gets the list of Android connected devices and emulators.
     */
    public getConnectedDevices(): Q.Promise<IDevice[]> {
        return this.childProcess.execToString("adb devices")
            .then(output => {
                return this.parseConnectedDevices(output);
            });
    }

    /**
     * Broadcasts an intent to reload the application in debug mode.
     */
    public switchDebugMode(projectRoot: string, packageName: string, enable: boolean, debugTarget?: string): Q.Promise<void> {
        let enableDebugCommand = `${this.adbExecutable} ${debugTarget ? "-s " + debugTarget : ""} shell am broadcast -a "${packageName}.RELOAD_APP_ACTION" --ez jsproxy ${enable}`;
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
    public launchApp(projectRoot: string, packageName: string, debugTarget?: string): Q.Promise<void> {
        let launchAppCommand = `${this.adbExecutable} ${debugTarget ? "-s " + debugTarget : ""} shell am start -n ${packageName}/.MainActivity`;
        return new CommandExecutor(projectRoot).execute(launchAppCommand);
    }

    public stopApp(projectRoot: string, packageName: string, debugTarget?: string): Q.Promise<void> {
        let stopAppCommand = `${this.adbExecutable} ${debugTarget ? "-s " + debugTarget : ""} shell am force-stop ${packageName}`;
        return new CommandExecutor(projectRoot).execute(stopAppCommand);
    }

    public apiVersion(deviceId: string): Q.Promise<AndroidAPILevel> {
        return this.executeQuery(deviceId, "shell getprop ro.build.version.sdk").then(output =>
            parseInt(output, 10));
    }

    public reverseAdb(deviceId: string, packagerPort: number): Q.Promise<void> {
        return this.execute(deviceId, `reverse tcp:${packagerPort} tcp:${packagerPort}`);
    }

    public showDevMenu(deviceId?: string): Q.Promise<void> {
        let command = `${this.adbExecutable} ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_MENU}`;
        return this.commandExecutor.execute(command);
    }

    public reloadApp(deviceId?: string): Q.Promise<void> {
        let commands = [
            `${this.adbExecutable} ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_MENU}`,
            `${this.adbExecutable} ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_DPAD_UP}`,
            `${this.adbExecutable} ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_DPAD_CENTER}`,
        ];

        return this.executeChain(commands);
    }

    public getOnlineDevices(): Q.Promise<IDevice[]> {
        return this.getConnectedDevices().then(devices => {
            return devices.filter(device =>
                device.isOnline);
        });
    }

    public startLogCat(adbParameters: string[]): ISpawnResult {
        return new ChildProcess().spawn(`${this.adbExecutable}`, adbParameters);
    }

    private parseConnectedDevices(input: string): IDevice[] {
        let result: IDevice[] = [];
        let regex = new RegExp("^(\\S+)\\t(\\S+)$", "mg");
        let match = regex.exec(input);
        while (match != null) {
            result.push({ id: match[1], isOnline: match[2] === "device", type: this.extractDeviceType(match[1]) });
            match = regex.exec(input);
        }
        return result;
    }

    private extractDeviceType(id: string): DeviceType {
        return id.match(AndroidSDKEmulatorPattern)
            ? DeviceType.AndroidSdkEmulator
            : DeviceType.Other;
    }

    private executeQuery(deviceId: string, command: string): Q.Promise<string> {
        return this.childProcess.execToString(this.generateCommandForDevice(deviceId, command));
    }

    private execute(deviceId: string, command: string): Q.Promise<void> {
        return this.commandExecutor.execute(this.generateCommandForDevice(deviceId, command));
    }

    private executeChain(commands: string[]): Q.Promise<any> {
        return commands.reduce((promise, command) => {
            return promise.then(() => this.commandExecutor.execute(command));
        }, Q(void 0));
    }

    private generateCommandForDevice(deviceId: string, adbCommand: string): string {
        return `${this.adbExecutable} -s "${deviceId}" ${adbCommand}`;
    }

    private getSdkLocationFromLocalPropertiesFile(projectRoot: string, logger: ILogger): string | null {
        const localPropertiesFilePath = path.join(projectRoot, "android", "local.properties");
        if (!fs.existsSync(localPropertiesFilePath)) {
            logger.info(`local.properties file doesn't exist. Using Android SDK location from PATH.`);
            return null;
        }

        let fileContent;
        try {
            fileContent = fs.readFileSync(localPropertiesFilePath);
        } catch (e) {
            logger.error(`Could read from ${localPropertiesFilePath}.`, e, e.stack);
            logger.info(`Using Android SDK location from PATH.`);
            return null;
        }
        const matches = fileContent.match(/^sdk\.dir=(.+)$/m);
        if (!matches || !matches[1]) {
            return null;
        }

        const sdkLocation = matches[1].trim();
        logger.info(`Using Android SDK location defined in android/local.properties file: ${sdkLocation}.`);

        return sdkLocation;
    }
}
