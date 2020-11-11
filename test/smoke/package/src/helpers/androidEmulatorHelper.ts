// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import { SmokeTestsConstants } from "./smokeTestsConstants";
import { sleep } from "./utilities";
import { SmokeTestLogger } from "./smokeTestLogger";

export interface IDevice {
    id: string;
    isOnline: boolean;
}
export class AndroidEmulatorHelper {
    public static EMULATOR_START_TIMEOUT = 120;
    public static EMULATOR_TERMINATING_TIMEOUT = 30;

    public static androidEmulatorPort = 5554;
    public static androidEmulatorName = `emulator-${AndroidEmulatorHelper.androidEmulatorPort}`;

    public static getDevice(): string | undefined {
        if (!process.env.ANDROID_EMULATOR) {
            throw new Error("Environment variable 'ANDROID_EMULATOR' is not set. Exiting...");
        }
        return process.env.ANDROID_EMULATOR;
    }

    public static getOnlineDevices(): IDevice[] {
        const devices = AndroidEmulatorHelper.getConnectedDevices();
        return devices.filter(device => device.isOnline);
    }

    public static getConnectedDevices(): IDevice[] {
        const devices = cp.execSync("adb devices").toString();
        return AndroidEmulatorHelper.parseConnectedDevices(devices);
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

    public static async waitUntilEmulatorStarting(): Promise<void> {
        return new Promise((resolve, reject) => {
            const rejectTimeout = setTimeout(() => {
                cleanup();
                reject(`Could not start the emulator within ${AndroidEmulatorHelper.EMULATOR_START_TIMEOUT} seconds.`);
            }, AndroidEmulatorHelper.EMULATOR_START_TIMEOUT * 1000);

            const bootCheckInterval = setInterval(async () => {
                const connectedDevices = AndroidEmulatorHelper.getOnlineDevices();
                if (connectedDevices.length > 0) {
                    SmokeTestLogger.info(`*** Android emulator has been started.`);
                    cleanup();
                    resolve();
                }
            }, 1000);

            const cleanup = () => {
                clearTimeout(rejectTimeout);
                clearInterval(bootCheckInterval);
            };
        });
    }

    public static async spawnAndKillEmulator() {
        cp.spawn("emulator", ["-avd", String(AndroidEmulatorHelper.getDevice())]);
        SmokeTestLogger.info("*** Wait until emulator starting");
        await AndroidEmulatorHelper.waitUntilEmulatorStarting();
        SmokeTestLogger.info("*** Terminating Android emulator");
        AndroidEmulatorHelper.terminateAndroidEmulator();
        await AndroidEmulatorHelper.waitUntilAndroidEmulatorTerminating();
    }

    public static async runAndroidEmulator() {
        this.terminateAndroidEmulator();
        // Boot options for emulator - https://developer.android.com/studio/run/emulator-commandline
        const emulatorOpts = ["-avd",
        <string>this.getDevice(),
         "-gpu", "swiftshader_indirect",
         "-wipe-data",
         "-port", this.androidEmulatorPort.toString(),
         "-no-snapshot-save",
         "-no-boot-anim",
         "-no-audio"];
         SmokeTestLogger.info(`*** Executing Android emulator with 'emulator ${emulatorOpts.join(" ")}' command...`);
        const proc = cp.spawn("emulator", emulatorOpts, {stdio: "pipe"});
        let started = false;
        proc.stdout.on("data", (chunk) => {
            process.stdout.write(chunk);
            if (/boot completed/.test(chunk.toString().trim())) {
                started = true;
            }
        });

        proc.stderr.on("data", (chunk) => {
            process.stderr.write(chunk);
        });

        SmokeTestLogger.info(`*** Waiting for emulator to load (timeout is ${SmokeTestsConstants.emulatorLoadTimeout}ms)`);
        let awaitRetries: number = SmokeTestsConstants.emulatorLoadTimeout / 1000;
        let retry = 1;
        await new Promise((resolve, reject) => {
            let check = setInterval(async () => {
                if (started) {
                    clearInterval(check);
                    SmokeTestLogger.success("*** Emulator finished loading, waiting for 2 seconds");
                    await sleep(2000);
                    resolve();
                } else {
                    retry++;
                    if (retry >= awaitRetries) {
                        // When time's up just let it go - emulator should have started at this time
                        // The reason why std check didn't work is more likely that extra logging (INFO level) for emulator was disabled
                        clearInterval(check);
                        resolve();
                    }
                }
            }, 1000);
        });
    }

    // Terminates emulator "emulator-PORT" if it exists, where PORT is 5554 by default
    public static terminateAndroidEmulator() {
        let devices = this.getOnlineDevices();
        SmokeTestLogger.info("*** Checking for running android emulators...");
        if (devices.length !== 0) {
            devices.forEach((device) => {
                SmokeTestLogger.info(`*** Terminating Android '${device.id}'...`);
                cp.execSync(`adb -s ${device.id} emu kill`, {stdio: "inherit"});
            });
        } else {
            SmokeTestLogger.warn("*** No running android emulators found");
        }
    }

    public static waitUntilAndroidEmulatorTerminating() {
        return new Promise((resolve, reject) => {
            const rejectTimeout = setTimeout(() => {
                cleanup();
                reject(`Could not terminate the emulator within ${AndroidEmulatorHelper.EMULATOR_TERMINATING_TIMEOUT} seconds.`);
            }, AndroidEmulatorHelper.EMULATOR_TERMINATING_TIMEOUT * 1000);

            const bootCheckInterval = setInterval(async () => {
                const connectedDevices = AndroidEmulatorHelper.getConnectedDevices();
                if (connectedDevices.length === 0) {
                    SmokeTestLogger.success(`*** All Android emulators are terminated.`);
                    cleanup();
                    resolve();
                }
            }, 1000);

            const cleanup = () => {
                clearTimeout(rejectTimeout);
                clearInterval(bootCheckInterval);
            };
        });
    }

    // Check if appPackage is installed on Android device for waitTime ms
    public static async checkIfAppIsInstalled(appPackage: string, waitTime: number, waitInitTime?: number) {
        let awaitRetries: number = waitTime / 1000;
        let retry = 1;
        await new Promise((resolve, reject) => {
            let check = setInterval(async () => {
                if (retry % 5 === 0) {
                    SmokeTestLogger.info(`*** Check if app is being installed with command 'adb shell pm list packages ${appPackage}' for ${retry} time`);
                }
                let result;
                try {
                    result = cp.execSync(`adb shell pm list packages ${appPackage}`).toString().trim();
                } catch (e) {
                    clearInterval(check);
                    reject(`Error occured while check app is installed:\n ${e}`);
                }
                if (result) {
                    clearInterval(check);
                    const initTimeout = waitInitTime || 10000;
                    SmokeTestLogger.info(`*** Installed ${appPackage} app found, await ${initTimeout}ms for initializing...`);
                    await sleep(initTimeout);
                    resolve();
                } else {
                    retry++;
                    if (retry >= awaitRetries) {
                        clearInterval(check);
                        reject(`${appPackage} not found after ${waitTime}ms`);
                    }
                }
            }, 1000);
        });
    }

    // Check if appPackage is installed on Android device for waitTime ms
    public static async checkIfAndroidAppIsInstalled(appPackage: string, waitTime: number, waitInitTime?: number) {
        let awaitRetries: number = waitTime / 1000;
        let retry = 1;
        await new Promise((resolve, reject) => {
            let check = setInterval(async () => {
                if (retry % 5 === 0) {
                    SmokeTestLogger.info(`*** Check if app is being installed with command 'adb shell pm list packages ${appPackage}' for ${retry} time`);
                }
                let result;
                try {
                    result = cp.execSync(`adb shell pm list packages ${appPackage}`).toString().trim();
                } catch (e) {
                    clearInterval(check);
                    reject(`Error occured while check app is installed:\n ${e}`);
                }
                if (result) {
                    clearInterval(check);
                    const initTimeout = waitInitTime || 10000;
                    SmokeTestLogger.info(`*** Installed ${appPackage} app found, await ${initTimeout}ms for initializing...`);
                    await sleep(initTimeout);
                    resolve();
                } else {
                    retry++;
                    if (retry >= awaitRetries) {
                        clearInterval(check);
                        reject(`${appPackage} not found after ${waitTime}ms`);
                    }
                }
            }, 1000);
        });
    }

    public static uninstallTestAppFromEmulator(appPackage: string) {
        SmokeTestLogger.info(`*** Uninstalling test app ${appPackage}' from Emulator`);
        try {
            cp.spawnSync("adb", ["shell", "pm", "uninstall", appPackage], { stdio: "inherit" });
        } catch (e) {
            SmokeTestLogger.error(`Error occured while uninstalling test app:\n ${e.toString()}`);
        }
    }

    public static async enableDrawPermitForApp(packageName: string) {
        const drawPermitCommand = `adb -s ${AndroidEmulatorHelper.androidEmulatorName} shell appops set ${packageName} SYSTEM_ALERT_WINDOW allow`;
        SmokeTestLogger.info(`*** Enabling permission for drawing over apps via: ${drawPermitCommand}`);
        cp.execSync(drawPermitCommand, {stdio: "inherit"});
    }
}
