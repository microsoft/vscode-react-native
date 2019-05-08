// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import * as wdio from "webdriverio";
import * as path from "path";
import * as mkdirp from "mkdirp";
import * as kill from "tree-kill";
import * as clipboardy from "clipboardy";
import { SmokeTestsConstants } from "./smokeTestsConstants";
import { sleep } from "./utilities";
let appiumProcess: null | cp.ChildProcess;
export type AppiumClient = WebdriverIO.Client<WebdriverIO.RawResult<null>> & WebdriverIO.RawResult<null>;
export enum Platform {
    Android,
    iOS,
    iOS_Expo,
}
type XPathSelector = { [TKey in Platform]: string };
type XPathSelectors = { [key: string]: XPathSelector };

export class AppiumHelper {
    // Paths for searching UI elements
    public static XPATH: XPathSelectors = {
        RN_RELOAD_BUTTON: {
            [Platform.Android]: "//*[@text='Reload']",
            [Platform.iOS]: "//XCUIElementTypeButton[@name='Reload']",
            [Platform.iOS_Expo]: "//XCUIElementTypeOther[@name='Reload JS Bundle']",
        },
        RN_ENABLE_REMOTE_DEBUGGING_BUTTON: {
            [Platform.Android]:  "//*[@text='Debug JS Remotely']",
            [Platform.iOS]: "//XCUIElementTypeButton[@name='Debug JS Remotely']",
            [Platform.iOS_Expo]: "//XCUIElementTypeOther[@name='Debug Remote JS']",
        },
        RN_STOP_REMOTE_DEBUGGING_BUTTON: {
            [Platform.Android]: "//*[@text='Stop Remote JS Debugging']",
            [Platform.iOS]: "//XCUIElementTypeButton[@name='Stop Remote JS Debugging']",
            [Platform.iOS_Expo]: "//XCUIElementTypeOther[@name='Stop Remote JS Debugging']",
        },
        RN_DEV_MENU_CANCEL: {
            [Platform.Android]: "//*[@text='Cancel']",
            [Platform.iOS]: "//XCUIElementTypeButton[@name='Cancel']",
            [Platform.iOS_Expo]: "(//XCUIElementTypeOther[@name='Cancel'])[1]",
        },
        EXPO_ELEMENT_LOAD_TRIGGER: {
            [Platform.Android]: "//*[@text='Home']",
            [Platform.iOS]: "", // todo
            [Platform.iOS_Expo]: "", // todo
        },
    };

    public static runAppium() {
        const appiumLogFolder = path.join(__dirname, "..", "..", "..", "..", SmokeTestsConstants.artifactsDir);
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

    public static terminateAppium() {
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

    public static prepareAttachOptsForAndroidActivity(applicationPackage: string, applicationActivity: string, deviceName: string = SmokeTestsConstants.defaultTargetAndroidDeviceName) {
        return {
            desiredCapabilities: {
                browserName: "",
                platformName: "Android",
                platformVersion: this.getAndroidPlatformVersion(),
                deviceName: deviceName,
                appActivity: applicationActivity,
                appPackage: applicationPackage,
                automationName: "UiAutomator2",
                newCommandTimeout: 150,
            },
            port: 4723,
            host: "localhost",
        };
    }

    public static prepareAttachOptsForIosApp(deviceName: string, appPath: string) {
        return {
            desiredCapabilities: {
                browserName: "",
                platformName: "iOS",
                platformVersion: this.getIosPlatformVersion(),
                deviceName: deviceName,
                app: appPath,
                automationName: "XCUITest",
                newCommandTimeout: 150,
            },
            port: 4723,
            host: "localhost",
        };
    }

    public static webdriverAttach(attachArgs: any) {
        // Connect to the emulator with predefined opts
        return wdio.remote(attachArgs);
    }

    public static async openExpoApplication(platform: Platform, client: AppiumClient, expoURL: string) {
        // There are two ways to run app in Expo app:
        // - via clipboard
        // - via Explore button
        if (platform === Platform.Android) {
            if (process.platform === "darwin") {
                // Longer way to open Expo app, but
                // it certainly works on Mac
                return this.openExpoAppViaExploreButtonAndroid(client, expoURL);
            } else {
                // The quickest way to open Expo app,
                // it doesn't work on Mac though
                return this.openExpoAppViaClipboardAndroid(client, expoURL);
            }
        } else if (platform === Platform.iOS) {
            // Similar to openExpoAppViaClipboardAndroid approach
            // but uses different XPath selectors
            return this.openExpoAppViaExploreButtonIos(client, expoURL);
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
    public static async callRNDevMenu(client: AppiumClient, platform: Platform) {
        switch (platform) {
            case Platform.Android:
                const devMenuCallCommand = "adb shell input keyevent 82";
                cp.exec(devMenuCallCommand);
                await sleep(10 * 1000);
                break;
            case Platform.iOS:
            case Platform.iOS_Expo:
                // Sending Cmd+D doesn't work sometimes but shake gesture works flawlessly
                client.shake();
                await sleep(2 * 1000);
                break;
            default:
                throw new Error("Unknown platform");
        }
    }

    public static async reloadRNApp(client: AppiumClient, platform: Platform) {
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

    public static async enableRemoteDebugJS(client: AppiumClient, platform: Platform) {
        console.log("*** Enabling Remote JS Debugging for application with DevMenu...");
        await client
        .waitUntil(async () => {
            await this.callRNDevMenu(client, platform);
            if (await client.isExisting(this.XPATH.RN_ENABLE_REMOTE_DEBUGGING_BUTTON[platform])) {
                console.log("*** Debug JS Remotely button found...");
                await client.click(this.XPATH.RN_ENABLE_REMOTE_DEBUGGING_BUTTON[platform]);
                console.log("*** Debug JS Remotely button clicked...");
                return true;
            } else if (await client.isExisting(this.XPATH.RN_STOP_REMOTE_DEBUGGING_BUTTON[platform])) {
                console.log("*** Stop Remote JS Debugging button found, closing Dev Menu...");
                if (await client.isExisting(this.XPATH.RN_DEV_MENU_CANCEL[platform])) {
                    console.log("*** Cancel button found...");
                    await client.click(this.XPATH.RN_DEV_MENU_CANCEL[platform]);
                    console.log("*** Cancel button clicked...");
                    return true;
                } else {
                    return false;
                }
            }
            return false;
        }, SmokeTestsConstants.enableRemoteJSTimeout, `Remote debugging UI element not found after ${SmokeTestsConstants.enableRemoteJSTimeout}ms`, 1000);
    }

    public static getIosPlatformVersion() {
        return process.env.IOS_VERSION || SmokeTestsConstants.defaultTargetIosPlatformVersion;
    }

    public static getAndroidPlatformVersion() {
        return process.env.ANDROID_VERSION || SmokeTestsConstants.defaultTargetAndroidPlatformVersion;
    }

    // Expo 32 has an error on iOS application start up
    // it is not breaking the app, but may broke the tests, so need to click Dismiss in the RN Red Box to proceed further
    public static async disableExpoErrorRedBox(client: AppiumClient) {
        const DISMISS_BUTTON = "//XCUIElementTypeButton[@name='redbox-dismiss']";
        if (await client.isExisting(DISMISS_BUTTON)) {
            console.log("*** React Native Red Box found, disabling...");
            await client.click(DISMISS_BUTTON);
        }
    }

    private static async openExpoAppViaClipboardAndroid(client: AppiumClient, expoURL: string) {
        // Expo application automatically detects Expo URLs in the clipboard
        // So we are copying expoURL to system clipboard and click on the special "Open from Clipboard" UI element
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

    private static async openExpoAppViaExploreButtonIos(client: AppiumClient, expoURL: string) {
        console.log(`*** Opening Expo app via "Explore" button`);
        console.log(`*** Pressing "Explore" button...`);
        const EXPO_EXPLORE_BUTTON = "//XCUIElementTypeOther[@name='Explore']";
        await client
            .waitForExist(EXPO_EXPLORE_BUTTON, 30 * 1000)
            .click(EXPO_EXPLORE_BUTTON);

        const FIND_A_PROJECT_ELEMENT = `(//XCUIElementTypeOther[@name='Find a project or enter a URL... '])[3]`;

        console.log(`*** Pasting ${expoURL} to text field...`);
        // Run Expo app by expoURL
        await client
            .waitForExist(FIND_A_PROJECT_ELEMENT, 30 * 1000)
            .click(FIND_A_PROJECT_ELEMENT);

        console.log(`*** Pasting ${expoURL} to search field...`);
        client.keys(expoURL);
        sleep(2 * 1000);

        console.log(`*** Clicking on first found result to run the app`);
        const TAP_TO_ATTEMPT_ELEMENT = `//XCUIElementTypeOther[@name='Tap to attempt to open project at ${expoURL}']`;
        await client
            .waitForExist(TAP_TO_ATTEMPT_ELEMENT, 10 * 1000)
            .click(`${TAP_TO_ATTEMPT_ELEMENT}//..`); // parent element is the one we should click on
    }

    private static async openExpoAppViaExploreButtonAndroid(client: AppiumClient, expoURL: string) {
        console.log(`*** Opening Expo app via "Explore" button`);
        console.log(`*** Pressing "Explore" button...`);
        const EXPLORE_ELEMENT = "//android.widget.Button[@content-desc=\"Explore\"]";
        await client
            .waitForExist(EXPLORE_ELEMENT, 30 * 1000)
            .click(EXPLORE_ELEMENT);
        console.log(`*** Pressing "Search" icon...`);

        // Elements hierarchy:
        // Parent element
        // |- Featured Projects    <- where we start searching
        // |- "Search" button     <- what we are looking for
        //
        const FEATURED_PROJECTS_ELEMENT = "//*[@text=\"Featured Projects\"]";
        await client
            .waitForExist(FEATURED_PROJECTS_ELEMENT, 5 * 1000)
            .click(`${FEATURED_PROJECTS_ELEMENT}//../child::*[2]`);

        console.log(`*** Pasting ${expoURL} to text field...`);
        const FIND_A_PROJECT_ELEMENT = "//*[@text=\"Find a project or enter a URL...\"]";
        await client
            .waitForExist(FIND_A_PROJECT_ELEMENT, 5 * 1000)
            .click(FIND_A_PROJECT_ELEMENT);
        client.keys(expoURL);
        sleep(2 * 1000);

        console.log(`*** Clicking on first found result to run the app`);
        const TAP_TO_ATTEMPT_ELEMENT = "//*[@text=\"Tap to attempt to open project at\"]";
        await client
            .waitForExist(TAP_TO_ATTEMPT_ELEMENT, 10 * 1000)
            .click(`${TAP_TO_ATTEMPT_ELEMENT}//..`); // parent element is the one we should click on
    }
}
