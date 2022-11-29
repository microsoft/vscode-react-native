// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as nls from "vscode-nls";
import { ILogger } from "../log/LogHelper";
import { CommandExecutor } from "../../common/commandExecutor";
import { ChildProcess, ISpawnResult } from "../../common/node/childProcess";
import { PromiseUtil } from "../../common/node/promise";
import { IDebuggableMobileTarget } from "../mobileTarget";

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

export class AdbHelper {
    private nodeModulesRoot: string;
    private launchActivity: string;
    private childProcess: ChildProcess = new ChildProcess();
    private commandExecutor: CommandExecutor;
    private adbExecutable: string = "";

    private static readonly AndroidRemoteTargetPattern =
        /^((?:\d{1,3}\.){3}\d{1,3}:\d{1,5}|.*_adb-tls-con{2}ect\._tcp.*)$/gm;
    public static readonly AndroidSDKEmulatorPattern = /^emulator-\d{1,5}$/;

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
    public async getConnectedTargets(): Promise<IDebuggableMobileTarget[]> {
        const output = await this.childProcess.execToString(`${this.adbExecutable} devices`);
        return this.parseConnectedTargets(output);
    }

    public async findOnlineTargetById(
        targetId: string,
    ): Promise<IDebuggableMobileTarget | undefined> {
        return (await this.getOnlineTargets()).find(target => target.id === targetId);
    }

    public async getAvdsNames(): Promise<string[]> {
        const res = await this.childProcess.execToString("emulator -list-avds");
        let emulatorsNames: string[] = [];
        if (res) {
            emulatorsNames = res.split(/\r?\n|\r/g);
            const indexOfBlank = emulatorsNames.indexOf("");
            if (indexOfBlank >= 0) {
                emulatorsNames.splice(indexOfBlank, 1);
            }
        }
        return emulatorsNames;
    }

    public isRemoteTarget(id: string): boolean {
        return !!id.match(AdbHelper.AndroidRemoteTargetPattern);
    }

    public async getAvdNameById(emulatorId: string): Promise<string | null> {
        try {
            const output = await this.childProcess.execToString(
                `${this.adbExecutable} -s ${emulatorId} emu avd name`,
            );
            // The command returns the name of avd by id of this running emulator.
            // Return value example:
            // "
            // emuName
            // OK
            // "
            return output ? output.split(/\r?\n|\r/g)[0] : null;
        } catch {
            // If the command returned an error, it means that we could not find the emulator with the passed id
            return null;
        }
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
        const enableDebugCommand = `${this.adbExecutable} ${
            debugTarget ? `-s ${debugTarget}` : ""
        } shell am broadcast -a "${packageName}.RELOAD_APP_ACTION" --ez jsproxy ${String(enable)}`;
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
        const launchAppCommand = `${this.adbExecutable} ${
            debugTarget ? `-s ${debugTarget}` : ""
        } shell am start -n ${packageName}${appIdSuffix ? `.${appIdSuffix}` : ""}/${packageName}.${
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
        const stopAppCommand = `${this.adbExecutable} ${
            debugTarget ? `-s ${debugTarget}` : ""
        } shell am force-stop ${packageName}${appIdSuffix ? `.${appIdSuffix}` : ""}`;
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
        const command = `${this.adbExecutable} ${
            deviceId ? `-s ${deviceId}` : ""
        } shell input keyevent ${KeyEvents.KEYCODE_MENU}`;
        return this.commandExecutor.execute(command);
    }

    public reloadApp(deviceId?: string): Promise<void> {
        const command = `${this.adbExecutable} ${
            deviceId ? `-s ${deviceId}` : ""
        } shell input text "RR"`;
        return this.commandExecutor.execute(command);
    }

    public async getOnlineTargets(): Promise<IDebuggableMobileTarget[]> {
        const devices = await this.getConnectedTargets();
        return devices.filter(device => device.isOnline);
    }

    public startLogCat(adbParameters: string[]): ISpawnResult {
        return this.childProcess.spawn(this.adbExecutable.replace(/"/g, ""), adbParameters);
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
        const sdkLocation = this.getSdkLocationFromLocalPropertiesFile(projectRoot, logger);
        if (sdkLocation) {
            const localPropertiesSdkPath = path.join(
                sdkLocation as string,
                "platform-tools",
                "adb.exe",
            );
            const isExist = fs.existsSync(localPropertiesSdkPath);
            if (isExist) {
                return localPropertiesSdkPath;
            }
            if (logger) {
                logger.info(
                    localize(
                        "LocalPropertiesFileAndroidSDKLocationNotExisting",
                        "Local.properties file has Andriod SDK path but cannot find it in your local, will switch to SDK PATH in environment variable. Please check Android SDK path in android/local.properties file.",
                    ),
                );
            }
            return "adb";
        }
        return "adb";
    }

    public executeShellCommand(deviceId: string, command: string): Promise<string> {
        return this.executeQuery(deviceId, `shell "${command}"`);
    }

    public executeQuery(deviceId: string, command: string): Promise<string> {
        return this.childProcess.execToString(this.generateCommandForTarget(deviceId, command));
    }

    private parseConnectedTargets(input: string): IDebuggableMobileTarget[] {
        const result: IDebuggableMobileTarget[] = [];
        const regex = new RegExp("^(\\S+)\\t(\\S+)$", "mg");
        let match = regex.exec(input);
        while (match != null) {
            result.push({
                id: match[1],
                isOnline: match[2] === "device",
                isVirtualTarget: this.isVirtualTarget(match[1]),
            });
            match = regex.exec(input);
        }
        return result;
    }

    public isVirtualTarget(id: string): boolean {
        return !!id.match(AdbHelper.AndroidSDKEmulatorPattern);
    }

    private execute(deviceId: string, command: string): Promise<void> {
        return this.commandExecutor.execute(this.generateCommandForTarget(deviceId, command));
    }

    private generateCommandForTarget(deviceId: string, adbCommand: string): string {
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
