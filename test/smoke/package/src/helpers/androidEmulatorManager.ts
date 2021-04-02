// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import { SmokeTestLogger } from "./smokeTestLogger";
import { SmokeTestsConstants } from "./smokeTestsConstants";
import { waitUntil, sleep } from "./utilities";
const XDL = require("xdl");

export interface IDevice {
    id: string;
    isOnline: boolean;
}

export interface ExpoClientData {
    url: string;
    version: string;
}

export default class AndroidEmulatorManager {
    private static readonly EMULATOR_START_TIMEOUT = 120_000;
    private static readonly EMULATOR_TERMINATING_TIMEOUT = 30_000;

    private static readonly PACKAGE_INSTALL_TIMEOUT = 600_000;
    private static readonly PACKAGE_INIT_TIMEOUT = 10_000;

    private emulatorName: string;
    private emulatorPort: number;
    private emulatorId: string;

    constructor(
        name: string | undefined = process.env.ANDROID_EMULATOR,
        port: number = SmokeTestsConstants.defaultTargetAndroidPort,
    ) {
        if (!name) {
            throw new Error(
                "Passed Android emulator name and process.env.ANDROID_EMULATOR is not defined!",
            );
        }
        this.emulatorName = name;
        this.emulatorPort = port;
        this.emulatorId = `emulator-${port}`;
    }

    public getEmulatorName(): string {
        return this.emulatorName;
    }

    public getEmulatorId(): string {
        return this.emulatorId;
    }

    // Check if appPackage is installed on Android device for waitTime ms
    public async waitUntilAppIsInstalled(appPackage: string): Promise<boolean> {
        SmokeTestLogger.info(
            `*** Check if app is being installed with command 'adb shell pm list packages ${appPackage}' for ${
                AndroidEmulatorManager.PACKAGE_INSTALL_TIMEOUT / 1000
            } seconds`,
        );

        const condition = () => {
            const result = cp
                .execSync(`adb shell pm list packages ${appPackage}`)
                .toString()
                .trim();
            if (result) {
                return true;
            }
            return false;
        };

        try {
            const result = await waitUntil(
                condition,
                AndroidEmulatorManager.PACKAGE_INSTALL_TIMEOUT,
            );
            if (result) {
                SmokeTestLogger.success(
                    `*** Installed ${appPackage} app found, await ${AndroidEmulatorManager.PACKAGE_INIT_TIMEOUT}ms for initializing...`,
                );
                await sleep(AndroidEmulatorManager.PACKAGE_INIT_TIMEOUT);
            } else {
                SmokeTestLogger.error(
                    `${appPackage} not found after ${AndroidEmulatorManager.PACKAGE_INSTALL_TIMEOUT} ms`,
                );
            }
            return result;
        } catch (e) {
            return Promise.reject(`Error occured while check app is installed:\n ${e}`);
        }
    }

    public async getExpoAndroidClientForSDK(expoSdkMajorVersion: string): Promise<ExpoClientData> {
        const sdkVersion = (await XDL.Versions.sdkVersionsAsync())[`${expoSdkMajorVersion}.0.0`];
        return {
            url: sdkVersion.androidClientUrl,
            version: sdkVersion.androidClientVersion,
        };
    }

    // Installs Expo app on Android device using XDL function
    public async installExpoAppOnAndroid(): Promise<void> {
        const expoClientData = await this.getExpoAndroidClientForSDK(
            process.env.EXPO_SDK_MAJOR_VERSION || "",
        );

        SmokeTestLogger.projectPatchingLog(
            `*** Installing Expo app v${expoClientData.version} on Android emulator using Expo XDL function`,
        );

        await XDL.Android.installExpoAsync({
            device: {
                name: this.emulatorId,
                type: "emulator",
                isBooted: true,
                isAuthorized: true,
            },
            url: expoClientData.url,
            version: expoClientData.version,
        });
        return this.enableDrawPermitForApp(SmokeTestsConstants.expoPackageName);
    }

    public uninstallTestAppFromEmulator(appPackage: string): void {
        SmokeTestLogger.info(`*** Uninstalling test app ${appPackage}' from Emulator`);
        try {
            cp.spawnSync("adb", ["shell", "pm", "uninstall", appPackage], { stdio: "inherit" });
        } catch (e) {
            SmokeTestLogger.error(`Error occured while uninstalling test app:\n ${e.toString()}`);
        }
    }

    private async enableDrawPermitForApp(packageName: string) {
        const drawPermitCommand = `adb -s ${this.emulatorId} shell appops set ${packageName} SYSTEM_ALERT_WINDOW allow`;
        SmokeTestLogger.projectPatchingLog(
            `*** Enabling permission for drawing over apps via: ${drawPermitCommand}`,
        );
        cp.execSync(drawPermitCommand, { stdio: "inherit" });
    }

    public async runAndroidEmulator(): Promise<boolean> {
        // Boot options for emulator - https://developer.android.com/studio/run/emulator-commandline
        await this.terminateAndroidEmulator();
        const emulatorOpts = [
            "-avd",
            <string>this.emulatorName,
            "-gpu",
            "swiftshader_indirect",
            "-wipe-data",
            "-port",
            String(this.emulatorPort),
            "-no-snapshot-save",
            "-no-boot-anim",
            "-no-audio",
        ];
        SmokeTestLogger.info(
            `*** Executing Android emulator with 'emulator ${emulatorOpts.join(" ")}' command...`,
        );
        const proc = cp.spawn("emulator", emulatorOpts, { stdio: "pipe" });
        proc.stdout.on("data", chunk => {
            process.stdout.write(chunk);
        });
        proc.stderr.on("data", chunk => {
            process.stderr.write(chunk);
        });
        return this.waitUntilEmulatorStarting().then(async result => {
            // Waiting for all services to start
            await sleep(60_000);
            return result;
        });
    }

    public async terminateAndroidEmulator(): Promise<boolean> {
        let devices = AndroidEmulatorManager.getOnlineDevices();
        SmokeTestLogger.info(`*** Checking for running emulator with id ${this.emulatorId}...`);
        if (devices.find(it => it.id === this.emulatorId)) {
            cp.execSync(`adb -s ${this.emulatorId} emu kill`, { stdio: "inherit" });
        } else {
            SmokeTestLogger.warn("*** No running android emulators found");
        }
        return this.waitUntilEmulatorTerminating();
    }

    public static async terminateAllAndroidEmulators(): Promise<boolean> {
        let devices = AndroidEmulatorManager.getOnlineDevices();
        SmokeTestLogger.info("*** Checking for running android emulators...");
        if (devices.length !== 0) {
            devices.forEach(device => {
                SmokeTestLogger.info(`*** Terminating Android '${device.id}'...`);
                cp.execSync(`adb -s ${device.id} emu kill`, { stdio: "inherit" });
            });
        } else {
            SmokeTestLogger.warn("*** No running android emulators found");
        }
        return AndroidEmulatorManager.waitUntilAllEmulatorTerminating();
    }

    public async waitUntilEmulatorStarting(): Promise<boolean> {
        SmokeTestLogger.info("*** Wait for Android emulator starting...");

        const condition = () => {
            const runningEmulators = AndroidEmulatorManager.getOnlineDevices();
            if (runningEmulators.find(it => it.id === this.emulatorId)) {
                return true;
            }
            return false;
        };

        return waitUntil(condition, AndroidEmulatorManager.EMULATOR_START_TIMEOUT).then(result => {
            if (result) {
                SmokeTestLogger.success(`*** Android emulator has been started.`);
            } else {
                SmokeTestLogger.error(
                    `*** Could not start Android emulator in ${AndroidEmulatorManager.EMULATOR_START_TIMEOUT} seconds.`,
                );
            }
            return result;
        });
    }

    public async waitUntilEmulatorTerminating(): Promise<boolean> {
        SmokeTestLogger.info("*** Wait for Android emulator terminating...");

        const condition = () => {
            const runningEmulators = AndroidEmulatorManager.getOnlineDevices();
            if (!runningEmulators.find(it => it.id === this.emulatorId)) {
                return true;
            }
            return false;
        };

        return waitUntil(condition, AndroidEmulatorManager.EMULATOR_TERMINATING_TIMEOUT).then(
            result => {
                if (result) {
                    SmokeTestLogger.success(`*** Android emulator has been terminated.`);
                } else {
                    SmokeTestLogger.error(
                        `*** Could not terminate Android emulator in ${AndroidEmulatorManager.EMULATOR_START_TIMEOUT} seconds.`,
                    );
                }
                return result;
            },
        );
    }

    public static async waitUntilSomeEmulatorStarting(): Promise<boolean> {
        SmokeTestLogger.info("*** Wait for Android emulator starting...");
        const countOfRunningEmulators = AndroidEmulatorManager.getOnlineDevices().length;

        const condition = () => {
            if (AndroidEmulatorManager.getOnlineDevices().length > countOfRunningEmulators) {
                return true;
            }
            return false;
        };

        return waitUntil(condition, AndroidEmulatorManager.EMULATOR_START_TIMEOUT).then(result => {
            if (result) {
                SmokeTestLogger.success(`*** Some Android emulator has been started.`);
            } else {
                SmokeTestLogger.error(
                    `*** Could not start any Android emulator in ${AndroidEmulatorManager.EMULATOR_START_TIMEOUT} seconds.`,
                );
            }
            return result;
        });
    }

    public static async waitUntilAllEmulatorTerminating(): Promise<boolean> {
        SmokeTestLogger.info("*** Wait for Android emulator terminating...");

        const condition = () => {
            if (AndroidEmulatorManager.getOnlineDevices().length === 0) {
                return true;
            }
            return false;
        };

        return waitUntil(condition, AndroidEmulatorManager.EMULATOR_TERMINATING_TIMEOUT).then(
            result => {
                if (result) {
                    SmokeTestLogger.success(`*** All Android emulators has been terminated.`);
                } else {
                    SmokeTestLogger.error(
                        `*** Could not terminate all Android emulator in ${AndroidEmulatorManager.EMULATOR_START_TIMEOUT} seconds.`,
                    );
                }
                return result;
            },
        );
    }

    public static closeApp(packageName: string): void {
        SmokeTestLogger.info(
            `*** Clearing installed application with package name ${packageName}...`,
        );
        cp.execSync(`adb shell pm clear ${packageName}`);
    }

    private static getOnlineDevices(): IDevice[] {
        const devices = this.getConnectedDevices();
        return devices.filter(device => device.isOnline);
    }

    private static getConnectedDevices(): IDevice[] {
        const devices = cp.execSync("adb devices").toString();
        return this.parseConnectedDevices(devices);
    }

    private static parseConnectedDevices(input: string): IDevice[] {
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
