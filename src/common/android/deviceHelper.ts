// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ChildProcess} from "../node/childProcess";
import {CommandExecutor} from "../commandExecutor";
import * as Q from "q";

export interface IDevice {
    id: string;
    isOnline: boolean;
}

export interface IDeviceHelper {
    getConnectedDevices(): Q.Promise<IDevice[]>;
    reloadAppInDebugMode(projectRoot: string, packageName: string, debugTarget?: string): Q.Promise<void>;
    launchApp(projectRoot: string, packageName: string, debugTarget?: string): Q.Promise<void>;
}

export class DeviceHelper implements IDeviceHelper {

    /**
     * Gets the list of Android connected devices and emulators.
     */
    public getConnectedDevices(): Q.Promise<IDevice[]> {
        let childProcess = new ChildProcess();
        return childProcess.execToString("adb devices")
            .then(output => {
                return this.parseConnectedDevices(output);
            });
    }

    /**
     * Broadcasts an intent to reload the application in debug mode.
     */
    public reloadAppInDebugMode(projectRoot: string, packageName: string, debugTarget?: string): Q.Promise<void> {
        let enableDebugCommand = `adb ${debugTarget ? "-s " + debugTarget : ""} shell am broadcast -a "${packageName}.RELOAD_APP_ACTION" --ez jsproxy true`;
        return new CommandExecutor(projectRoot).execute(enableDebugCommand);
    }

    /**
     * Sends an intent which launches the main activity of the application.
     */
    public launchApp(projectRoot: string, packageName: string, debugTarget?: string): Q.Promise<void> {
        let launchAppCommand = `adb -s ${debugTarget} shell am start -n ${packageName}/.MainActivity`;
        return new CommandExecutor(projectRoot).execute(launchAppCommand);
    }

    private parseConnectedDevices(input: string): IDevice[] {
        let result: IDevice[] = [];
        let regex = new RegExp("^(\\S+)\\t(\\S+)$", "mg");
        let match = regex.exec(input);
        while (match != null) {
            result.push({ id: match[1], isOnline: match[2] === "device" });
            match = regex.exec(input);
        }
        return result;
    }
}