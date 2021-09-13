// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ChildProcess, ISpawnResult } from "../../common/node/childProcess";
import { CommandExecutor } from "../../common/commandExecutor";
import { IDevice } from "../../common/device";
import * as path from "path";
import * as fs from "fs";
import { ILogger } from "../log/LogHelper";
import * as os from "os";
import * as nls from "vscode-nls";
import { PromiseUtil } from "../../common/node/promise";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

// See android versions usage at: http://developer.android.com/about/dashboards/index.html
export enum AndroidAPILevel {
    Marshmallow = 23,
    LOLLIPOP_MR1 = 22,
    LOLLIPOP = 21 /* Supports adb reverse */,
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

export enum AdbDeviceType {
    AndroidSdkEmulator, // These seem to have emulator-<port> ids
    RemoteDevice,
    Other,
}

export interface IAdbDevice extends IDevice {
    isOnline: boolean;
    type: AdbDeviceType;
}

interface AdbDeviceTypePattern {
    pattern: RegExp;
    adbDeviceType: AdbDeviceType;
}

export class AdbHelper {
    private nodeModulesRoot: string;
    private launchActivity: string;
    private childProcess: ChildProcess = new ChildProcess();
    private commandExecutor: CommandExecutor;
    private adbExecutable: string = "";

    private static ADB_DEVICE_TYPE_PATTERNS: AdbDeviceTypePattern[] = [
        {
            pattern: /^emulator-\d{1,5}$/gm,
            adbDeviceType: AdbDeviceType.AndroidSdkEmulator,
        },
        {
            pattern: /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}|.*_adb-tls-connect\._tcp.*)$/gm,
            adbDeviceType: AdbDeviceType.RemoteDevice,
        },
    ];

    constructor(
        projectRoot: string,
        nodeModulesRoot: string,
        logger?: ILogger,
        launchActivity: string = "MainActivity",
    ) {
        this.nodeModulesRoot = nodeModulesRoot;
        this.adbExecutable = this.getAdbPath(projectRoot, logger);
        this.commandExecutor = new CommandExecutor(this.nodeModulesRoot);
        this.launchActivity = launchActivity;
    }

    /**
     * Gets the list of Android connected devices and emulators.
     */
    public async getConnectedDevices(): Promise<IAdbDevice[]> {
        const output = await this.childProcess.execToString(`${this.adbExecutable} devices`);
        return this.parseConnectedDevices(output);
    }

    public setLaunchActivity(launchActivity: string): void {
        this.launchActivity = launchActivity;
    }

    /**
     * Broadcasts an intent to reload the application in debug mode.
     */
    public async switchDebugMode(
        projectRoot: string,
        packageName: string,
        enable: boolean,
        debugTarget?: string,
        appIdSuffix?: string,
    ): Promise<void> {
        let enableDebugCommand = `${this.adbExecutable} ${
            debugTarget ? "-s " + debugTarget : ""
        } shell am broadcast -a "${packageName}.RELOAD_APP_ACTION" --ez jsproxy ${enable}`;
        await new CommandExecutor(this.nodeModulesRoot, projectRoot).execute(enableDebugCommand);
        // We should stop and start application again after RELOAD_APP_ACTION, otherwise app going to hangs up
        await PromiseUtil.delay(200); // We need a little delay after broadcast command
        await this.stopApp(projectRoot, packageName, debugTarget, appIdSuffix);
        return this.launchApp(projectRoot, packageName, debugTarget, appIdSuffix);
    }

    /**
     * Sends an intent which launches the main activity of the application.
     */
    public launchApp(
        projectRoot: string,
        packageName: string,
        debugTarget?: string,
        appIdSuffix?: string,
    ): Promise<void> {
        let launchAppCommand = `${this.adbExecutable} ${
            debugTarget ? "-s " + debugTarget : ""
        } shell am start -n ${packageName}${appIdSuffix ? "." + appIdSuffix : ""}/${packageName}.${
            this.launchActivity
        }`;
        return new CommandExecutor(projectRoot).execute(launchAppCommand);
    }

    public stopApp(
        projectRoot: string,
        packageName: string,
        debugTarget?: string,
        appIdSuffix?: string,
    ): Promise<void> {
        let stopAppCommand = `${this.adbExecutable} ${
            debugTarget ? "-s " + debugTarget : ""
        } shell am force-stop ${packageName}${appIdSuffix ? "." + appIdSuffix : ""}`;
        return new CommandExecutor(projectRoot).execute(stopAppCommand);
    }

    public async apiVersion(deviceId: string): Promise<AndroidAPILevel> {
        const output = await this.executeQuery(deviceId, "shell getprop ro.build.version.sdk");
        return parseInt(output, 10);
    }

    public reverseAdb(deviceId: string, port: number): Promise<void> {
        return this.execute(deviceId, `reverse tcp:${port} tcp:${port}`);
    }

    public showDevMenu(deviceId?: string): Promise<void> {
        let command = `${this.adbExecutable} ${
            deviceId ? "-s " + deviceId : ""
        } shell input keyevent ${KeyEvents.KEYCODE_MENU}`;
        return this.commandExecutor.execute(command);
    }

    public reloadApp(deviceId?: string): Promise<void> {
        let command = `${this.adbExecutable} ${
            deviceId ? "-s " + deviceId : ""
        } shell input text "RR"`;
        return this.commandExecutor.execute(command);
    }

    public async getOnlineDevices(): Promise<IAdbDevice[]> {
        const devices = await this.getConnectedDevices();
        return devices.filter(device => device.isOnline);
    }

    public startLogCat(adbParameters: string[]): ISpawnResult {
        return this.childProcess.spawn(this.adbExecutable.replace(/\"/g, ""), adbParameters);
    }

    public parseSdkLocation(fileContent: string, logger?: ILogger): string | null {
        const matches = fileContent.match(/^sdk\.dir\s*=(.+)$/m);
        if (!matches || !matches[1]) {
            if (logger) {
                logger.info(
                    localize(
                        "NoSdkDirFoundInLocalPropertiesFile",
                        "No sdk.dir value found in local.properties file. Using Android SDK location from PATH.",
                    ),
                );
            }
            return null;
        }

        let sdkLocation = matches[1].trim();
        if (os.platform() === "win32") {
            // For Windows we need to unescape files separators and drive letter separators
            sdkLocation = sdkLocation.replace(/\\\\/g, "\\").replace("\\:", ":");
        }
        if (logger) {
            logger.info(
                localize(
                    "UsindAndroidSDKLocationDefinedInLocalPropertiesFile",
                    "Using Android SDK location defined in android/local.properties file: {0}.",
                    sdkLocation,
                ),
            );
        }

        return sdkLocation;
    }

    public getAdbPath(projectRoot: string, logger?: ILogger): string {
        // Trying to read sdk location from local.properties file and if we succueded then
        // we would run adb from inside it, otherwise we would rely to PATH
        const sdkLocation = this.getSdkLocationFromLocalPropertiesFile(projectRoot, logger);
        return sdkLocation ? `"${path.join(sdkLocation, "platform-tools", "adb")}"` : "adb";
    }

    public executeShellCommand(deviceId: string, command: string): Promise<string> {
        return this.executeQuery(deviceId, `shell "${command}"`);
    }

    public executeQuery(deviceId: string, command: string): Promise<string> {
        return this.childProcess.execToString(this.generateCommandForDevice(deviceId, command));
    }

    private parseConnectedDevices(input: string): IAdbDevice[] {
        let result: IAdbDevice[] = [];
        let regex = new RegExp("^(\\S+)\\t(\\S+)$", "mg");
        let match = regex.exec(input);
        while (match != null) {
            result.push({
                id: match[1],
                isOnline: match[2] === "device",
                type: this.extractDeviceType(match[1]),
            });
            match = regex.exec(input);
        }
        return result;
    }

    private extractDeviceType(id: string): AdbDeviceType {
        for (let pattern of AdbHelper.ADB_DEVICE_TYPE_PATTERNS) {
            if (id.match(pattern.pattern)) {
                return pattern.adbDeviceType;
            }
        }
        return AdbDeviceType.Other;
    }

    private execute(deviceId: string, command: string): Promise<void> {
        return this.commandExecutor.execute(this.generateCommandForDevice(deviceId, command));
    }

    private generateCommandForDevice(deviceId: string, adbCommand: string): string {
        return `${this.adbExecutable} -s "${deviceId}" ${adbCommand}`;
    }

    private getSdkLocationFromLocalPropertiesFile(
        projectRoot: string,
        logger?: ILogger,
    ): string | null {
        const localPropertiesFilePath = path.join(projectRoot, "android", "local.properties");
        if (!fs.existsSync(localPropertiesFilePath)) {
            if (logger) {
                logger.info(
                    localize(
                        "LocalPropertiesFileDoesNotExist",
                        "local.properties file doesn't exist. Using Android SDK location from PATH.",
                    ),
                );
            }
            return null;
        }

        let fileContent: string;
        try {
            fileContent = fs.readFileSync(localPropertiesFilePath).toString();
        } catch (e) {
            if (logger) {
                logger.error(
                    localize(
                        "CouldNotReadFrom",
                        "Couldn't read from {0}.",
                        localPropertiesFilePath,
                    ),
                    e,
                    e.stack,
                );
                logger.info(
                    localize(
                        "UsingAndroidSDKLocationFromPATH",
                        "Using Android SDK location from PATH.",
                    ),
                );
            }
            return null;
        }
        return this.parseSdkLocation(fileContent, logger);
    }
}
