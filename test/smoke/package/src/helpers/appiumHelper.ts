// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import * as wdio from "webdriverio";
import * as path from "path";
import * as mkdirp from "mkdirp";
import * as kill from "tree-kill";
import { SmokeTestsConstants } from "./smokeTestsConstants";
import { sleep } from "./utilities";
import * as clipboardy from "clipboardy";
let appiumProcess: null | cp.ChildProcess;
export type AppiumClient = WebdriverIO.Client<WebdriverIO.RawResult<null>> & WebdriverIO.RawResult<null>;
export enum Platform {
    Android,
    AndroidExpo,
    iOS,
    iOSExpo,
}
const XDL = require("@expo/xdl");

type XPathSelector = { [TKey in Platform]: string };
type XPathSelectors = { [key: string]: XPathSelector };

interface IAttachOpts {
    desiredCapabilities: {
        browserName: string,
        platformName: string,
        platformVersion: string,
        deviceName: string,
        appActivity?: string,
        appPackage?: string,
        automationName: string,
        newCommandTimeout: number,
        app?: string,
    };
    port: number;
    host: string;
}

export class AppiumHelper {
    // Paths for searching UI elements
    public static XPATH: XPathSelectors = {
        RN_RELOAD_BUTTON: {
            [Platform.Android]: "//*[@text='Reload']",
            [Platform.AndroidExpo]: "//*[@text='Reload']",
            [Platform.iOS]: "//XCUIElementTypeButton[@name='Reload']",
            [Platform.iOSExpo]: "//XCUIElementTypeOther[@name='Reload JS Bundle']",
        },
        RN_ENABLE_REMOTE_DEBUGGING_BUTTON: {
            [Platform.Android]:  "//*[@text='Debug JS Remotely' or @text='Debug']",
            [Platform.AndroidExpo]: "//*[@text='Debug Remote JS']",
            [Platform.iOS]: "//XCUIElementTypeButton[@name='Debug JS Remotely' or @name='Debug']",
            [Platform.iOSExpo]: "//XCUIElementTypeOther[@name=' Debug Remote JS']",
        },
        RN_STOP_REMOTE_DEBUGGING_BUTTON: {
            [Platform.Android]: "//*[@text='Stop Remote JS Debugging' or @text='Stop Debugging']",
            [Platform.AndroidExpo]: "//*[@text='Stop Remote Debugging']",
            [Platform.iOS]: "//XCUIElementTypeButton[@name='Stop Remote JS Debugging' or @name='Stop Debugging']",
            [Platform.iOSExpo]: "//XCUIElementTypeOther[@name=' Stop Remote Debugging']",
        },
        RN_DEV_MENU_CANCEL: {
            [Platform.Android]: "//*[@text='Cancel']",
            [Platform.AndroidExpo]: "//*[@text='Cancel']",
            [Platform.iOS]: "//XCUIElementTypeButton[@name='Cancel']",
            [Platform.iOSExpo]: "(//XCUIElementTypeOther[@name='Cancel'])[1]",
        },
        EXPO_ELEMENT_LOAD_TRIGGER: {
            [Platform.Android]: "",
            [Platform.AndroidExpo]: "//*[@text='Home']",
            [Platform.iOS]: "", // todo
            [Platform.iOSExpo]: "", // todo
        },
        GOT_IT_BUTTON: {
            [Platform.Android]: "",
            [Platform.AndroidExpo]: "//*[@text='Got it']",
            [Platform.iOS]: "",
            [Platform.iOSExpo]: "//XCUIElementTypeOther[@name='Got it']",
        },
    };

    public static runAppium(artifactsPath: string): void {
        const appiumLogFolder = artifactsPath;
        mkdirp.sync(appiumLogFolder);
        const appiumLogPath = path.join(appiumLogFolder, "appium.log");
        console.log(`*** Executing Appium with logging to ${appiumLogPath}`);
        let appiumCommand = process.platform === "win32" ? "appium.cmd" : "appium";
        // We need to inherit stdio streams because, otherwise, on Windows appium is stuck at the middle of the Expo test.
        // We ignore stdout because --log already does the trick, but keeps stdin and stderr.
        appiumProcess = cp.spawn(appiumCommand, ["--log", appiumLogPath], { stdio: ["inherit", "ignore", "inherit"] });
        appiumProcess.on("exit", () => {
            console.log("*** Appium terminated");
        });
        appiumProcess.on("error", (error) => {
            console.log("Error occurred in Appium process: ", error);
        });
    }

    public static terminateAppium(): void {
        if (appiumProcess) {
            console.log(`*** Terminating Appium with PID ${appiumProcess.pid}`);
            console.log(`*** Sending SIGINT to Appium process with PID ${appiumProcess.pid}`);
            const errorCallback = (err) => {
                if (err) {
                    console.log("Error occured while terminating Appium");
                    throw err;
                }
            };
            kill(appiumProcess.pid, "SIGINT", errorCallback);
            if (process.platform !== "win32") {
                sleep(10 * 1000);
                // Send a final kill signal to appium process
                // Explanation: https://github.com/appium/appium/issues/12297#issuecomment-472511676
                console.log(`*** Sending SIGINT to Appium process with PID ${appiumProcess.pid} again`);
                if (!appiumProcess.killed) {
                    kill(appiumProcess.pid, "SIGINT", errorCallback);
                }
            }
        }
    }

    public static prepareAttachOptsForAndroidActivity(applicationPackage: string, applicationActivity: string, deviceName: string = SmokeTestsConstants.defaultTargetAndroidDeviceName): IAttachOpts {
        return {
            desiredCapabilities: {
                browserName: "",
                platformName: "Android",
                platformVersion: process.env.ANDROID_VERSION || SmokeTestsConstants.defaultTargetAndroidPlatformVersion,
                deviceName: deviceName,
                appActivity: applicationActivity,
                appPackage: applicationPackage,
                automationName: "UiAutomator2",
                newCommandTimeout: 300,
            },
            port: 4723,
            host: "localhost",
        };
    }

    public static prepareAttachOptsForIosApp(deviceName: string, appPath: string): IAttachOpts{
        return {
            desiredCapabilities: {
                browserName: "",
                platformName: "iOS",
                platformVersion: process.env.IOS_VERSION || SmokeTestsConstants.defaultTargetIosPlatformVersion,
                deviceName: deviceName,
                app: appPath,
                automationName: "XCUITest",
                newCommandTimeout: 500,
            },
            port: 4723,
            host: "localhost",
        };
    }

    public static webdriverAttach(attachArgs: IAttachOpts): any {
        // Connect to the emulator with predefined opts
        return wdio.remote(attachArgs);
    }

    public static async openExpoApplication(platform: Platform, client: AppiumClient, expoURL: string, projectFolder: string, firstLaunch?: boolean): Promise<void> {
        // There are two ways to run app in Expo app:
        // - via clipboard
        // - via expo XDL function
        if (platform === Platform.Android) {
            if (process.platform === "darwin") {
                // Longer way to open Expo app, but
                // it certainly works on Mac
                return this.openExpoAppViaExpoXDLAndroidFunction(client, projectFolder);
            } else {
                // The quickest way to open Expo app,
                // it doesn't work on Mac though
                return this.openExpoAppViaClipboardAndroid(client, expoURL);
            }
        } else if (platform === Platform.iOS) {
            // Launch Expo using XDL.Simulator function
            return this.openExpoAppViaExpoXDLSimulatorFunction(client, projectFolder, firstLaunch);
        } else {
            throw new Error(`Unknown platform ${platform}`);
        }
    }

    /**
     * Enables RN Dev Menu on native app
     * @see https://facebook.github.io/react-native/docs/debugging#accessing-the-in-app-developer-menu
     * @param client - Initialized Appium client
     * @param platform - Android or iOS
     */
    public static async callRNDevMenu(client: AppiumClient, platform: Platform): Promise<void> {
        switch (platform) {
            case Platform.Android:
            case Platform.AndroidExpo:
                console.log("*** Opening DevMenu by calling 'adb shell input keyevent 82'...");
                const devMenuCallCommand = "adb shell input keyevent 82";
                cp.exec(devMenuCallCommand);
                await sleep(10 * 1000);
                break;
            case Platform.iOS:
            case Platform.iOSExpo:
                // Sending Cmd+D doesn't work sometimes but shake gesture works flawlessly
                console.log("*** Opening DevMenu by sending shake gesture...");
                client.shake();
                await sleep(2 * 1000);
                break;
            default:
                throw new Error("Unknown platform");
        }
    }

    public static async reloadRNApp(client: AppiumClient, platform: Platform): Promise<void> {
        console.log("*** Reloading React Native application with DevMenu...");
        await client
        .waitUntil(async () => {
            await this.callRNDevMenu(client, platform);
            if (await client.isExisting(this.XPATH.RN_RELOAD_BUTTON[platform])) {
                console.log("*** Reload button found...");
                await client.click(this.XPATH.RN_RELOAD_BUTTON[platform]);
                console.log("*** Reload button clicked...");
                return true;
            }
            return false;
        }, SmokeTestsConstants.enableRemoteJSTimeout, `Remote debugging UI element not found after ${SmokeTestsConstants.enableRemoteJSTimeout}ms`, 1000);
    }

    public static async enableRemoteDebugJS(client: AppiumClient, platform: Platform): Promise<void> {
        console.log("*** Enabling Remote JS Debugging for application with DevMenu...");

        await client
        .waitUntil(async () => {
            if (await client.isExisting(this.XPATH.RN_ENABLE_REMOTE_DEBUGGING_BUTTON[platform])) {
                console.log("*** Debug JS Remotely button found...");
                await client.click(this.XPATH.RN_ENABLE_REMOTE_DEBUGGING_BUTTON[platform]);
                console.log("*** Debug JS Remotely button clicked...");
                await sleep(1000);
                if (await client.isExisting(this.XPATH.RN_ENABLE_REMOTE_DEBUGGING_BUTTON[platform])) {
                    await client.click(this.XPATH.RN_ENABLE_REMOTE_DEBUGGING_BUTTON[platform]);
                    console.log("*** Debug JS Remotely button clicked second time...");
                }
                return true;
            } else if (await client.isExisting(this.XPATH.RN_STOP_REMOTE_DEBUGGING_BUTTON[platform])) {
                console.log("*** Stop Remote JS Debugging button found, closing Dev Menu...");
                if (await client.isExisting(this.XPATH.RN_DEV_MENU_CANCEL[platform])) {
                    console.log("*** Cancel button found...");
                    await client.click(this.XPATH.RN_DEV_MENU_CANCEL[platform]);
                    console.log("*** Cancel button clicked...");
                    return true;
                } else {
                    await this.callRNDevMenu(client, platform);
                    return false;
                }
            }
            await this.callRNDevMenu(client, platform);
            return false;
        }, SmokeTestsConstants.enableRemoteJSTimeout, `Remote debugging UI element not found after ${SmokeTestsConstants.enableRemoteJSTimeout}ms`, 1000);
    }

    // Expo 32 has an error on iOS application start up
    // it is not breaking the app, but may broke the tests, so need to click Dismiss button in the RN Red Box to proceed further
    public static async disableExpoErrorRedBox(client: AppiumClient): Promise<void> {
        const DISMISS_BUTTON = "//XCUIElementTypeButton[@name='redbox-dismiss']";
        if (await client.isExisting(DISMISS_BUTTON)) {
            console.log("*** React Native Red Box found, disabling...");
            await client.click(DISMISS_BUTTON);
        }
    }

    // New Expo versions shows DevMenu at first launch with informational message,
    // it is better to disable this message and then call DevMenu ourselves
    public static async disableDevMenuInformationalMsg(client: AppiumClient, platform: Platform): Promise<void> {
        const GOT_IT_BUTTON = this.XPATH.GOT_IT_BUTTON[platform];
        if (await client.isExisting(GOT_IT_BUTTON)) {
            console.log("*** Expo DevMenu informational message found, disabling...");
            await client.click(GOT_IT_BUTTON);
        }
    }

    public static async clickTestButtonHermes(client: AppiumClient): Promise<void> {
        console.log(`*** Pressing button with text "Test Button"...`);
        const TEST_BUTTON = "//*[@text='TEST BUTTON']";
        await client.click(TEST_BUTTON);
    }

    public static async isHermesWorking(client: AppiumClient): Promise<boolean> {
        const HERMES_MARK = "//*[@text='Engine: Hermes']";
        return await client
            .waitForExist(HERMES_MARK, 30 * 1000)
            .isExisting(HERMES_MARK);
    }

    private static async openExpoAppViaClipboardAndroid(client: AppiumClient, expoURL: string) {
        // Expo application automatically detects Expo URLs in the clipboard
        // So we are copying expoURL to system clipboard and click on the special "Open from Clipboard" UI element
        const EXPLORE_ELEMENT = "//android.widget.TextView[@text='Projects']";
        await client
            .waitForExist(EXPLORE_ELEMENT, 30 * 1000)
            .click(EXPLORE_ELEMENT);
        console.log(`*** Pressing "Projects" icon...`);

        console.log(`*** Opening Expo app via clipboard`);
        console.log(`*** Copying ${expoURL} to system clipboard...`);
        clipboardy.writeSync(expoURL);
        const EXPO_OPEN_FROM_CLIPBOARD = "//*[@text='Open from Clipboard']";
        console.log(`*** Searching for ${EXPO_OPEN_FROM_CLIPBOARD} element for click...`);
        // Run Expo app by expoURL
        await client
            .waitForExist(EXPO_OPEN_FROM_CLIPBOARD, 30 * 1000)
            .click(EXPO_OPEN_FROM_CLIPBOARD);
        console.log(`*** ${EXPO_OPEN_FROM_CLIPBOARD} clicked...`);
    }

    private static async openExpoAppViaExpoXDLAndroidFunction(client: AppiumClient, projectFolder: string): Promise<void> {
        console.log(`*** Opening Expo app via XDL.Android function`);
        console.log(`*** Searching for the "Explore" button...`);
        const EXPLORE_ELEMENT = "//android.widget.TextView[@text='Projects']";
        await client
            .waitForExist(EXPLORE_ELEMENT, 30 * 1000);

        await XDL.Android.openProjectAsync(projectFolder);
    }

    private static async openExpoAppViaExpoXDLSimulatorFunction(client: AppiumClient, projectFolder: string, firstLaunch?: boolean) {
        console.log(`*** Opening Expo app via XDL.Simulator function`);
        console.log(`*** Searching for the "Explore" button...`);

        const EXPLORE_ELEMENT = `//XCUIElementTypeButton[@name="Explore, tab, 2 of 4"]`;
        await client
            .waitForExist(EXPLORE_ELEMENT, 30 * 1000);

        await XDL.Simulator.openProjectAsync(projectFolder);

        if (firstLaunch) { // it's required to allow launch of an Expo application when it's launched for the first time
            console.log(`*** First launch of Expo app`);
            console.log(`*** Pressing "Open" button...`);

            const OPEN_BUTTON = `//XCUIElementTypeButton[@name="Open"]`;

            await client
                .waitForExist(OPEN_BUTTON, 10 * 1000)
                .click(OPEN_BUTTON);
        }
    }
}
