
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import { SmokeTestsConstants } from "./smokeTestsConstants";
import { waitUntil, sleep } from "./utilities";
const XDL = require("@expo/xdl");

export interface IDevice {
    id: string;
    isOnline: boolean;
}

export default class AndroidEmulatorManager {
    private static readonly EMULATOR_START_TIMEOUT = 120_000;
    private static readonly EMULATOR_TERMINATING_TIMEOUT = 30_000;

    private static readonly PACKAGE_INSTALL_TIMEOUT = 300_000;
    private static readonly PACKAGE_INIT_TIMEOUT = 10_000;

    private emulatorName: string;
    private emulatorPort: number;
    private emulatorId: string;

    constructor(name: string | undefined = process.env.ANDROID_EMULATOR, port: number = SmokeTestsConstants.defaultTargetAndroidPort) {
        if (!name) {
            throw new Error("Passed Android emulator name and process.env.ANDROID_EMULATOR is not defined!");
        }
        this.emulatorName = name;
        this.emulatorPort = port;
        this.emulatorId = `emulator-${port}`;
    }

    public getEmulatorName(): string {
        return this.emulatorName;
    }

    // Check if appPackage is installed on Android device for waitTime ms
    public async waitUntilAppIsInstalled(appPackage: string): Promise<boolean>{

        console.log(`*** Check if app is being installed with command 'adb shell pm list packages ${appPackage}' for ${AndroidEmulatorManager.PACKAGE_INSTALL_TIMEOUT / 1000} seconds`);

        const condition = () => {
            const result = cp.execSync(`adb shell pm list packages ${appPackage}`).toString().trim();
            if (result) {
                return true;
            }
            return false;
        };

        return waitUntil(condition, AndroidEmulatorManager.PACKAGE_INSTALL_TIMEOUT)
        .then((result) => {
            if (result) {
                console.log(`*** Installed ${appPackage} app found, await ${AndroidEmulatorManager.PACKAGE_INIT_TIMEOUT}ms for initializing...`);
                return sleep(AndroidEmulatorManager.PACKAGE_INIT_TIMEOUT)
                .then(() => result);
            }
            else {
                console.log(`${appPackage} not found after ${AndroidEmulatorManager.PACKAGE_INSTALL_TIMEOUT} ms`);
            }
            return result;
        })
        .catch((e) => {
            return Promise.reject(`Error occured while check app is installed:\n ${e}`);
        });
    }

    // Installs Expo app on Android device using XDL function
    public async installExpoAppOnAndroid(): Promise<void> {
        console.log(`*** Installing Expo app on Android emulator using Expo XDL function`);
        await XDL.Android.installExpoAsync();
        return this.enableDrawPermitForApp(SmokeTestsConstants.expoPackageName);
    }

    public uninstallTestAppFromEmulator(appPackage: string): void {
        console.log(`*** Uninstalling test app ${appPackage}' from Emulator`);
        try {
            cp.spawnSync("adb", ["shell", "pm", "uninstall", appPackage], {stdio: "inherit"});
        } catch (e) {
            console.error(`Error occured while uninstalling test app:\n ${e}`);
        }
    }

    private async enableDrawPermitForApp(packageName: string) {
        const drawPermitCommand = `adb -s ${this.emulatorId} shell appops set ${packageName} SYSTEM_ALERT_WINDOW allow`;
        console.log(`*** Enabling permission for drawing over apps via: ${drawPermitCommand}`);
        cp.execSync(drawPermitCommand, {stdio: "inherit"});
    }

    public async runAndroidEmulator(): Promise<boolean> {
        // Boot options for emulator - https://developer.android.com/studio/run/emulator-commandline
        await this.terminateAndroidEmulator();
        const emulatorOpts = ["-avd",
        <string>this.emulatorName,
         "-gpu", "swiftshader_indirect",
         "-wipe-data",
         "-port", String(this.emulatorPort),
         "-no-snapshot-save",
         "-no-boot-anim",
         "-no-audio"];
        console.log(`*** Executing Android emulator with 'emulator ${emulatorOpts.join(" ")}' command...`);
        const proc = cp.spawn("emulator", emulatorOpts, {stdio: "pipe"});
        proc.stdout.on("data", (chunk) => {
            process.stdout.write(chunk);
        });
        proc.stderr.on("data", (chunk) => {
            process.stderr.write(chunk);
        });
        return this.waitUntilEmulatorStarting();
    }

    public async terminateAndroidEmulator(): Promise<boolean> {
        let devices = AndroidEmulatorManager.getOnlineDevices();
        console.log(`*** Checking for running emulator with id ${this.emulatorId}...`);
        if (devices.find((it) => it.id === this.emulatorId)) {
            cp.execSync(`adb -s ${this.emulatorId} emu kill`, {stdio: "inherit"});
        } else {
            console.log("*** No running android emulators found");
        }
        return this.waitUntilEmulatorTerminating();
    }

    public static async terminateAllAndroidEmulators(): Promise<boolean> {
        let devices = AndroidEmulatorManager.getOnlineDevices();
        console.log("*** Checking for running android emulators...");
        if (devices.length !== 0) {
            devices.forEach((device) => {
                console.log(`*** Terminating Android '${device.id}'...`);
                cp.execSync(`adb -s ${device.id} emu kill`, {stdio: "inherit"});
            });
        } else {
            console.log("*** No running android emulators found");
        }
        return AndroidEmulatorManager.waitUntilAllEmulatorTerminating();
    }

    public async waitUntilEmulatorStarting(): Promise<boolean> {
        ("*** Wait for Android emulator starting...");

        const condition = () => {
            const runningEmulators = AndroidEmulatorManager.getOnlineDevices();
            if (runningEmulators.find((it) => it.id === this.emulatorId)) {
                return true;
            }
            return false;
        };

        return waitUntil(condition, AndroidEmulatorManager.EMULATOR_START_TIMEOUT)
            .then((result) => {
                if (result) {
                    console.log(`*** Android emulator has been started.`);
                }
                else {
                    console.log(`*** Could not start Android emulator in ${AndroidEmulatorManager.EMULATOR_START_TIMEOUT} seconds.`);
                }
                return result;
            });
    }

    public async waitUntilEmulatorTerminating(): Promise<boolean> {
        console.log("*** Wait for Android emulator terminating...");

        const condition = () => {
            const runningEmulators = AndroidEmulatorManager.getOnlineDevices();
            if (!runningEmulators.find((it) => it.id === this.emulatorId)) {
                return true;
            }
            return false;
        };

        return waitUntil(condition, AndroidEmulatorManager.EMULATOR_TERMINATING_TIMEOUT)
            .then((result) => {
                if (result) {
                    console.log(`*** Android emulator has been terminated.`);
                }
                else {
                    console.log(`*** Could not terminate Android emulator in ${AndroidEmulatorManager.EMULATOR_START_TIMEOUT} seconds.`);
                }
                return result;
            });
    }

    public static async waitUntilSomeEmulatorStarting(): Promise<boolean> {
        console.log("*** Wait for Android emulator starting...");
        const countOfRunningEmulators = AndroidEmulatorManager.getOnlineDevices().length;

        const condition = () => {
            if (AndroidEmulatorManager.getOnlineDevices().length > countOfRunningEmulators) {
                return true;
            }
            return false;
        };

        return waitUntil(condition, AndroidEmulatorManager.EMULATOR_START_TIMEOUT)
            .then((result) => {
                if (result) {
                    console.log(`*** Some Android emulator has been started.`);
                }
                else {
                    console.log(`*** Could not start any Android emulator in ${AndroidEmulatorManager.EMULATOR_START_TIMEOUT} seconds.`);
                }
                return result;
            });
    }

    public static async waitUntilAllEmulatorTerminating(): Promise<boolean> {
        console.log("*** Wait for Android emulator terminating...");

        const condition = () => {
            if (AndroidEmulatorManager.getOnlineDevices().length === 0) {
                return true;
            }
            return false;
        };

        return waitUntil(condition, AndroidEmulatorManager.EMULATOR_TERMINATING_TIMEOUT)
            .then((result) => {
                if (result) {
                    console.log(`*** All Android emulators has been terminated.`);
                }
                else {
                    console.log(`*** Could not terminate all Android emulator in ${AndroidEmulatorManager.EMULATOR_START_TIMEOUT} seconds.`);
                }
                return result;
            });
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
            result.push({ id: match[1], isOnline: match[2] === "device"});
            match = regex.exec(input);
        }
        return result;
    }
}