// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import { SmokeTestsConstants } from "./smokeTestsConstants";
import { sleep } from "./utilities";

export interface IDevice {
    id: string;
    isOnline: boolean;
}
export class AndroidEmulatorHelper {
    private static EMULATOR_START_TIMEOUT = 300;

    public static androidEmulatorPort = 5554;
    public static androidEmulatorName = `emulator-${AndroidEmulatorHelper.androidEmulatorPort}`;

    private static HIDDEN_API_POLICY_KEYS = [
        'hidden_api_policy_pre_p_apps',
        'hidden_api_policy_p_apps',
        'hidden_api_policy'
    ];

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
            result.push({ id: match[1], isOnline: match[2] === "device"});
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
                    console.log(`*** Android emulator has been started.`);
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

    // Set hidden api policy to manage access to non-SDK APIs.
    // https://developer.android.com/preview/restrictions-non-sdk-interfaces
    //     For Android P
    //     0: Disable non-SDK API usage detection. This will also disable logging, and also break the strict mode API,
    //     detectNonSdkApiUsage(). Not recommended.
    //     1: "Just warn" - permit access to all non-SDK APIs, but keep warnings in the log.
    //        The strict mode API will keep working.
    //     2: Disallow usage of dark grey and black listed APIs.
    //     3: Disallow usage of blacklisted APIs, but allow usage of dark grey listed APIs.

    //     For Android Q
    //     0: Disable all detection of non-SDK interfaces. Using this setting disables all log messages for non-SDK interface usage
    //        and prevents you from testing your app using the StrictMode API. This setting is not recommended.
    //     1: Enable access to all non-SDK interfaces, but print log messages with warnings for any non-SDK interface usage.
    //        Using this setting also allows you to test your app using the StrictMode API.
    //     2: Disallow usage of non-SDK interfaces that belong to either the black list
    //        or to a restricted greylist for your target API level.

    public static setHiddenApiPolicy(value: number) {
        const commands = AndroidEmulatorHelper.HIDDEN_API_POLICY_KEYS.map((key: string) => `adb settings put global ${key} ${value}`);
        commands.forEach((command: string) => cp.execSync(command));
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
        console.log(`*** Executing Android emulator with 'emulator ${emulatorOpts.join(" ")}' command...`);
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

        console.log(`*** Waiting for emulator to load (timeout is ${SmokeTestsConstants.emulatorLoadTimeout}ms)`);
        let awaitRetries: number = SmokeTestsConstants.emulatorLoadTimeout / 1000;
        let retry = 1;
        await new Promise((resolve, reject) => {
            let check = setInterval(async () => {
                if (started) {
                    clearInterval(check);
                    console.log("*** Emulator finished loading, waiting for 2 seconds");
                    await sleep(2000);
                    this.setHiddenApiPolicy(1);
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
        console.log("*** Checking for running android emulators...");
        if (devices.length !== 0) {
            devices.forEach((device) => {
                console.log(`Terminating Android '${device.id}'...`);
                cp.execSync(`adb -s ${device.id} emu kill`, {stdio: "inherit"});
            });
        } else {
            console.log("*** No running android emulators found");
        }
    }

    // Check if appPackage is installed on Android device for waitTime ms
    public static async checkIfAppIsInstalled(appPackage: string, waitTime: number, waitInitTime?: number) {
        let awaitRetries: number = waitTime / 1000;
        let retry = 1;
        await new Promise((resolve, reject) => {
            let check = setInterval(async () => {
                if (retry % 5 === 0) {
                    console.log(`*** Check if app is being installed with command 'adb shell pm list packages ${appPackage}' for ${retry} time`);
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
                    console.log(`*** Installed ${appPackage} app found, await ${initTimeout}ms for initializing...`);
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
                    console.log(`*** Check if app is being installed with command 'adb shell pm list packages ${appPackage}' for ${retry} time`);
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
                    console.log(`*** Installed ${appPackage} app found, await ${initTimeout}ms for initializing...`);
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
        console.log(`*** Uninstalling test app ${appPackage}' from Emulator`);
        try {
            cp.spawnSync("adb", ["shell", "pm", "uninstall", appPackage], {stdio: "inherit"});
        } catch (e) {
            console.error(`Error occured while uninstalling test app:\n ${e}`);
        }
    }

    public static async enableDrawPermitForApp(packageName: string) {
        const drawPermitCommand = `adb -s ${AndroidEmulatorHelper.androidEmulatorName} shell appops set ${packageName} SYSTEM_ALERT_WINDOW allow`;
        console.log(`*** Enabling permission for drawing over apps via: ${drawPermitCommand}`);
        cp.execSync(drawPermitCommand, {stdio: "inherit"});
    }
}
