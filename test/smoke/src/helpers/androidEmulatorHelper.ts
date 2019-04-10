// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as kill from "tree-kill";
import * as cp from "child_process";
import { SmokeTestsConstants } from "./smokeTestsConstants";
import { sleep } from "./setupEnvironmentHelper";

export class AndroidEmulatorHelper {
    public static expoPackageName = "host.exp.exponent";
    public static androidEmulatorPort = 5554;
    public static androidEmulatorName = `emulator-${AndroidEmulatorHelper.androidEmulatorPort}`;

    // Installs Expo app on Android device via "expo android" command
    public static async installExpoAppOnAndroid(expoAppPath: string) {
        console.log(`*** Installing Expo app (${this.expoPackageName}) on android device with 'expo-cli android' command`);
        let expoCliCommand = process.platform === "win32" ? "expo-cli.cmd" : "expo-cli";
        let installerProcess = cp.spawn(expoCliCommand, ["android"], {cwd: expoAppPath, stdio: "inherit"});
        installerProcess.on("close", () => {
            console.log("*** expo-cli terminated");
        });
        installerProcess.on("error", (error) => {
            console.log("Error occurred in expo-cli process: ", error);
        });
        await this.checkIfAppIsInstalled(this.expoPackageName, 100 * 1000);
        kill(installerProcess.pid, "SIGINT");
        await sleep(1000);
        const drawPermitCommand = `adb -s ${this.androidEmulatorName} shell appops set ${this.expoPackageName} SYSTEM_ALERT_WINDOW allow`;
        console.log(`*** Enabling permission for drawing over apps via: ${drawPermitCommand}`);
        cp.execSync(drawPermitCommand, {stdio: "inherit"});
    }

    public static async runAndroidEmulator() {
        if (!process.env.ANDROID_EMULATOR) {
            throw new Error("Environment variable 'ANDROID_EMULATOR' is not set. Exiting...");
        }
        this.terminateAndroidEmulator();
        // Boot options for emulator - https://developer.android.com/studio/run/emulator-commandline
        const emulatorOpts = ["-avd",
         process.env.ANDROID_EMULATOR || "",
         "-gpu", "swiftshader_indirect",
         "-wipe-data",
         "-port", this.androidEmulatorPort.toString(),
         "-no-snapshot",
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
        let devices = cp.execSync("adb devices").toString().trim();
        console.log("*** Checking for running android emulators...");
        if (devices !== "List of devices attached") {
            // Check if we already have a running emulator, and terminate it if it so
            console.log(`Terminating Android '${this.androidEmulatorName}'...`);
            cp.execSync(`adb -s ${this.androidEmulatorName} emu kill`, {stdio: "inherit"});
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
}
