// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import * as wdio from "webdriverio";
import * as path from "path";
import * as mkdirp from "mkdirp";
import * as kill from "tree-kill";
import * as clipboardy from "clipboardy";
import { smokeTestsConstants } from "./smokeTestsConstants";
import { sleep } from "./setupEnvironmentHelper";
let appiumProcess: null | cp.ChildProcess;

export class appiumHelper {
    // Android UI elements
    public static RN_RELOAD_BUTTON = "//*[@text='Reload']";
    public static RN_ENABLE_REMOTE_DEBUGGING_BUTTON = "//*[@text='Debug JS Remotely']";
    public static RN_STOP_REMOTE_DEBUGGING_BUTTON = "//*[@text='Stop Remote JS Debugging']";
    public static EXPO_OPEN_FROM_CLIPBOARD = "//*[@text='Open from Clipboard']";
    public static EXPO_ELEMENT_LOAD_TRIGGER = "//*[@text='Home']";

    public static runAppium() {
        const appiumLogFolder = path.join(__dirname, "..", "..", "..", "..", "SmokeTestLogs");
        mkdirp.sync(appiumLogFolder);
        const appiumLogPath = path.join(appiumLogFolder, "appium.log");
        console.log(`*** Executing Appium with logging to ${appiumLogPath}`);
        let appiumCommand = process.platform === "win32" ? "appium.cmd" : "appium";
        appiumProcess = cp.spawn(appiumCommand, ["--log", appiumLogPath]);
        appiumProcess.on("close", () => {
            console.log("*** Appium terminated");
        });
        appiumProcess.on("error", (error) => {
            console.log("Error occurred in Appium process: ", error);
        });
    }

    public static terminateAppium() {
        if (appiumProcess) {
            console.log(`*** Terminating Appium`);
            kill(appiumProcess.pid, "SIGINT");
        }
    }

    public static prepareAttachOptsForAndroidActivity(applicationPackage: string, applicationActivity: string,
    platformVersion: string = smokeTestsConstants.defaultTargetAndroidPlatformVersion, deviceName: string = smokeTestsConstants.defaultTargetAndroidDeviceName) {
        return {
            desiredCapabilities: {
                browserName: "",
                platformName: "Android",
                platformVersion: platformVersion,
                deviceName: deviceName,
                appActivity: applicationActivity,
                appPackage: applicationPackage,
                automationName: "UiAutomator2"
            },
            port: 4723,
            host: "localhost",
        };
    }

    // Check if appPackage is installed on Android device for waitTime ms
    public static async checkAppIsInstalled(appPackage: string, waitTime: number, waitInitTime?: number) {
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
                }
                catch (e) {
                    clearInterval(check);
                    reject(`Error occured while check app is installed:\n ${e}`);
                }
                if (result) {
                    clearInterval(check);
                    const initTimeout = waitInitTime || 10000;
                    console.log(`*** Installed ${appPackage} app found, await ${initTimeout}ms for initializing...`)
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

    public static webdriverAttach(attachArgs: any) {
        // Connect to the emulator with predefined opts
        return wdio.remote(attachArgs);
    }

    public static async openExpoApplicationAndroid(client: WebdriverIO.Client<WebdriverIO.RawResult<null>> & WebdriverIO.RawResult<null>, expoURL: string) {
        // Expo application automatically detects Expo URLs in the clipboard
        // So we are copying expoURL to system clipboard and click on the special "Open from Clipboard" UI element
        console.log(`*** Copying ${expoURL} to system clipboard...`);
        clipboardy.writeSync(expoURL);
        console.log(`*** Searching for ${this.EXPO_OPEN_FROM_CLIPBOARD} element for click...`);
        // Run Expo app by expoURL
        await client
        .waitForExist(this.EXPO_OPEN_FROM_CLIPBOARD, 30000)
        .click(this.EXPO_OPEN_FROM_CLIPBOARD);
        console.log(`*** ${this.EXPO_OPEN_FROM_CLIPBOARD} clicked...`);
    }

    public static async reloadRNAppAndroid(client: WebdriverIO.Client<WebdriverIO.RawResult<null>> & WebdriverIO.RawResult<null>) {
        console.log("*** Reloading React Native application with DevMenu...");
        await client
        .waitUntil(async () => {
            // This command enables RN Dev Menu
            // https://facebook.github.io/react-native/docs/debugging#accessing-the-in-app-developer-menu
            const devMenuCallCommand = "adb shell input keyevent 82";
            cp.exec(devMenuCallCommand);
            await sleep(300);
            if (client.isExisting(this.RN_RELOAD_BUTTON)) {
                console.log("*** Reload button found...");
                client.click(this.RN_RELOAD_BUTTON);
                console.log("*** Reload button clicked...");
                return true;
            }
            return false;
        }, smokeTestsConstants.enableRemoteJSTimeout, `Remote debugging UI element not found after ${smokeTestsConstants.enableRemoteJSTimeout}ms`, 1000);
    }

    public static async enableRemoteDebugJSForRNAndroid(client: WebdriverIO.Client<WebdriverIO.RawResult<null>> & WebdriverIO.RawResult<null>) {
        console.log("*** Enabling Remote JS Debugging for application with DevMenu...");
        await client
        .waitUntil(async () => {
            // This command enables RN Dev Menu
            // https://facebook.github.io/react-native/docs/debugging#accessing-the-in-app-developer-menu
            const devMenuCallCommand = "adb shell input keyevent 82";
            cp.exec(devMenuCallCommand);
            await sleep(300);
            if (client.isExisting(this.RN_ENABLE_REMOTE_DEBUGGING_BUTTON)) {
                console.log("*** Debug JS Remotely button found...");
                client.click(this.RN_ENABLE_REMOTE_DEBUGGING_BUTTON);
                console.log("*** Debug JS Remotely button clicked...");
                return true;
            } else if (client.isExisting(this.RN_STOP_REMOTE_DEBUGGING_BUTTON)) {
                console.log("*** Stop Remote JS Debugging button found...");
                return true;
            }
            return false;
        }, smokeTestsConstants.enableRemoteJSTimeout, `Remote debugging UI element not found after ${smokeTestsConstants.enableRemoteJSTimeout}ms`, 1000);
    }
}
