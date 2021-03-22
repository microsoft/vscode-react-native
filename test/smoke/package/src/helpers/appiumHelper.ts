// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import * as wdio from "webdriverio";
import * as mkdirp from "mkdirp";
import * as kill from "tree-kill";
import { SmokeTestsConstants } from "./smokeTestsConstants";
import { sleep, waitUntil } from "./utilities";
import * as clipboardy from "clipboardy";
import { SmokeTestLogger } from "./smokeTestLogger";

let appiumProcess: null | cp.ChildProcess;
export type AppiumClient = wdio.BrowserObject;
export enum Platform {
    Android,
    AndroidExpo,
    iOS,
    iOSExpo,
}
const XDL = require("xdl");

type XPathSelector = { [TKey in Platform]: string };
type XPathSelectors = { [key: string]: XPathSelector };

export class AppiumHelper {
    private static waitUntilEnableRemoteDebugOptions: wdio.WaitUntilOptions = {
        timeout: SmokeTestsConstants.enableRemoteJSTimeout,
        timeoutMsg: `Remote debugging UI element not found after ${SmokeTestsConstants.enableRemoteJSTimeout}ms`,
        interval: 1000,
    };

    // Paths for searching UI elements
    public static XPATH: XPathSelectors = {
        RN_RELOAD_BUTTON: {
            [Platform.Android]: "//*[@text='Reload']",
            [Platform.AndroidExpo]: "//*[@text='Reload']",
            [Platform.iOS]: "//XCUIElementTypeButton[@name='Reload']",
            [Platform.iOSExpo]: "//XCUIElementTypeOther[@name='Reload JS Bundle']",
        },
        RN_ENABLE_REMOTE_DEBUGGING_BUTTON: {
            [Platform.Android]: "//*[@text='Debug JS Remotely' or @text='Debug']",
            [Platform.AndroidExpo]: "//*[@text='Debug Remote JS']",
            [Platform.iOS]: "//XCUIElementTypeButton[@name='Debug JS Remotely' or @name='Debug']",
            [Platform.iOSExpo]: "//XCUIElementTypeOther[@name='󰢹 Debug Remote JS']",
        },
        RN_STOP_REMOTE_DEBUGGING_BUTTON: {
            [Platform.Android]: "//*[@text='Stop Remote JS Debugging' or @text='Stop Debugging']",
            [Platform.AndroidExpo]: "//*[@text='Stop Remote Debugging']",
            [Platform.iOS]:
                "//XCUIElementTypeButton[@name='Stop Remote JS Debugging' or @name='Stop Debugging']",
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

    public static runAppium(appiumLogPath: string): void {
        SmokeTestLogger.info(`*** Executing Appium with logging to ${appiumLogPath}`);
        let appiumCommand = process.platform === "win32" ? "appium.cmd" : "appium";
        // We need to inherit stdio streams because, otherwise, on Windows appium is stuck at the middle of the Expo test.
        // We ignore stdout because --log already does the trick, but keeps stdin and stderr.
        appiumProcess = cp.spawn(appiumCommand, ["--log", appiumLogPath], {
            stdio: ["inherit", "ignore", "inherit"],
        });
        appiumProcess.on("exit", () => {
            SmokeTestLogger.info("*** Appium terminated");
        });
        appiumProcess.on("error", error => {
            SmokeTestLogger.error(`Error occurred in Appium process: ${error.toString()}`);
        });
    }

    public static async terminateAppium(): Promise<boolean> {
        const errorCallback = err => {
            if (err) {
                SmokeTestLogger.error("Error occured while terminating Appium");
                throw err;
            }
        };

        if (appiumProcess) {
            let retrieveProcessesData;
            if (process.platform == "win32") {
                retrieveProcessesData = () => cp.execSync("tasklist").toString();
            } else {
                retrieveProcessesData = () => {
                    try {
                        return appiumProcess
                            ? cp.execSync(`ps -p ${appiumProcess.pid}`).toString()
                            : "";
                    } catch (err) {
                        if (err.stdout.toString() && !err.stderr.toString()) {
                            return err.stdout.toString();
                        } else {
                            throw err;
                        }
                    }
                };
            }

            const condition = () => {
                if (appiumProcess && retrieveProcessesData().includes(String(appiumProcess.pid))) {
                    SmokeTestLogger.info(
                        `*** Sending SIGINT to Appium process with PID ${appiumProcess.pid}`,
                    );
                    kill(appiumProcess.pid, "SIGINT", errorCallback);
                    return false;
                } else {
                    return true;
                }
            };

            return waitUntil(condition, 5 * 60 * 1000, 10 * 1000).then(result => {
                if (result) {
                    SmokeTestLogger.success(`*** Appium process was killed`);
                } else {
                    SmokeTestLogger.error(`*** Could not kill Appium process`);
                }
                return result;
            });
        } else {
            return true;
        }
    }

    public static prepareAttachOptsForAndroidActivity(
        applicationPackage: string,
        applicationActivity: string,
        deviceName: string = SmokeTestsConstants.defaultTargetAndroidDeviceName,
    ): wdio.RemoteOptions {
        SmokeTestLogger.info(
            `*** process.env.WEBDRIVER_IO_LOGS_DIR: ${process.env.WEBDRIVER_IO_LOGS_DIR}`,
        );
        return {
            capabilities: {
                platformName: "Android",
                platformVersion:
                    process.env.ANDROID_VERSION ||
                    SmokeTestsConstants.defaultTargetAndroidPlatformVersion,
                deviceName: deviceName,
                appActivity: applicationActivity,
                appPackage: applicationPackage,
                automationName: "UiAutomator2",
                newCommandTimeout: 300,
            },
            path: "/wd/hub",
            port: 4723,
            logLevel: "trace",
            outputDir: process.env.WEBDRIVER_IO_LOGS_DIR,
        };
    }

    public static prepareAttachOptsForIosApp(
        deviceName: string,
        appPath: string,
    ): wdio.RemoteOptions {
        SmokeTestLogger.info(
            `*** process.env.WEBDRIVER_IO_LOGS_DIR: ${process.env.WEBDRIVER_IO_LOGS_DIR}`,
        );
        return {
            capabilities: {
                platformName: "iOS",
                platformVersion:
                    process.env.IOS_VERSION || SmokeTestsConstants.defaultTargetIosPlatformVersion,
                deviceName: deviceName,
                app: appPath,
                automationName: "XCUITest",
                newCommandTimeout: 500,
            },
            path: "/wd/hub",
            port: 4723,
            logLevel: "trace",
            outputDir: process.env.WEBDRIVER_IO_LOGS_DIR,
        };
    }

    public static webdriverAttach(attachArgs: wdio.RemoteOptions): Promise<wdio.BrowserObject> {
        // Connect to the emulator with predefined opts
        return wdio.remote(attachArgs);
    }

    public static createWebdriverIOLogDir(webdriverIOLogDir: string): void {
        mkdirp.sync(webdriverIOLogDir);
    }

    public static async openExpoApplication(
        platform: Platform,
        client: AppiumClient,
        expoURL: string,
        projectFolder: string,
        firstLaunch?: boolean,
    ): Promise<void> {
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
                SmokeTestLogger.info(
                    "*** Opening DevMenu by calling 'adb shell input keyevent 82'...",
                );
                const devMenuCallCommand = "adb shell input keyevent 82";
                cp.exec(devMenuCallCommand);
                await sleep(10 * 1000);
                break;
            case Platform.iOS:
            case Platform.iOSExpo:
                // Sending Cmd+D doesn't work sometimes but shake gesture works flawlessly
                SmokeTestLogger.info("*** Opening DevMenu by sending shake gesture...");
                await client.shake();
                await sleep(2 * 1000);
                break;
            default:
                throw new Error("Unknown platform");
        }
    }

    public static async reloadRNApp(client: AppiumClient, platform: Platform): Promise<void> {
        SmokeTestLogger.info("*** Reloading React Native application with DevMenu...");
        const reloadButton = await client.$(this.XPATH.RN_RELOAD_BUTTON[platform]);
        await client.waitUntil(async () => {
            await this.callRNDevMenu(client, platform);
            if (await reloadButton.isExisting()) {
                SmokeTestLogger.info("*** Reload button found...");
                await reloadButton.click();
                SmokeTestLogger.info("*** Reload button clicked...");
                return true;
            }
            return false;
        }, this.waitUntilEnableRemoteDebugOptions);
    }

    public static async enableRemoteDebugJS(
        client: AppiumClient,
        platform: Platform,
    ): Promise<void> {
        SmokeTestLogger.info("*** Enabling Remote JS Debugging for application with DevMenu...");

        const enableRemoteDebugButton = await client.$(
            this.XPATH.RN_ENABLE_REMOTE_DEBUGGING_BUTTON[platform],
        );
        const enableRemoteDebugStopButton = await client.$(
            this.XPATH.RN_STOP_REMOTE_DEBUGGING_BUTTON[platform],
        );
        const enableRemoteDebugCancelButton = await client.$(
            this.XPATH.RN_DEV_MENU_CANCEL[platform],
        );
        await client.waitUntil(async () => {
            if (await enableRemoteDebugButton.isExisting()) {
                SmokeTestLogger.info("*** Debug JS Remotely button found...");
                await enableRemoteDebugButton.click();
                SmokeTestLogger.info("*** Debug JS Remotely button clicked...");
                await sleep(1000);
                if (await enableRemoteDebugButton.isExisting()) {
                    await enableRemoteDebugButton.click();
                    SmokeTestLogger.info("*** Debug JS Remotely button clicked second time...");
                }
                return true;
            } else if (await enableRemoteDebugStopButton.isExisting()) {
                SmokeTestLogger.info(
                    "*** Stop Remote JS Debugging button found, closing Dev Menu...",
                );
                if (await enableRemoteDebugCancelButton.isExisting()) {
                    SmokeTestLogger.info("*** Cancel button found...");
                    await enableRemoteDebugCancelButton.click();
                    SmokeTestLogger.info("*** Cancel button clicked...");
                    return true;
                } else {
                    await this.callRNDevMenu(client, platform);
                    return false;
                }
            }
            await this.callRNDevMenu(client, platform);
            return false;
        }, this.waitUntilEnableRemoteDebugOptions);
    }

    // Expo 32 has an error on iOS application start up
    // it is not breaking the app, but may broke the tests, so need to click Dismiss button in the RN Red Box to proceed further
    public static async disableExpoErrorRedBox(client: AppiumClient): Promise<void> {
        const dismissButton = await client.$("//XCUIElementTypeButton[@name='redbox-dismiss']");
        if (await dismissButton.isExisting()) {
            SmokeTestLogger.info("*** React Native Red Box found, disabling...");
            await dismissButton.click();
        }
    }

    // New Expo versions shows DevMenu at first launch with informational message,
    // it is better to disable this message and then call DevMenu ourselves
    public static async disableDevMenuInformationalMsg(
        client: AppiumClient,
        platform: Platform,
    ): Promise<void> {
        const gotItButton = await client.$(this.XPATH.GOT_IT_BUTTON[platform]);
        if (await gotItButton.isExisting()) {
            SmokeTestLogger.info("*** Expo DevMenu informational message found, disabling...");
            await gotItButton.click();
        }
    }

    public static async clickTestButtonHermes(
        client: AppiumClient,
        platform: Platform,
    ): Promise<void> {
        SmokeTestLogger.info(`*** Pressing button with text "Test Button"...`);
        let testButton: any;
        switch (platform) {
            case Platform.Android:
                testButton = await client.$("//*[@text='TEST BUTTON']");
                break;
            case Platform.iOS:
                testButton = await client.$('//XCUIElementTypeButton[@name="Test Button"]');
                break;
        }
        await testButton.click();
    }

    public static async isHermesWorking(
        client: AppiumClient,
        platform: Platform,
    ): Promise<boolean> {
        let hermesMark: any;
        switch (platform) {
            case Platform.Android:
                hermesMark = await client.$("//*[@text='Engine: Hermes']");
                break;
            case Platform.iOS:
                hermesMark = await client.$('//XCUIElementTypeStaticText[@name="Engine: Hermes"]');
                break;
        }
        return await hermesMark.waitForExist({
            timeout: SmokeTestsConstants.waitForElementTimeout,
        });
    }

    private static async openExpoAppViaClipboardAndroid(client: AppiumClient, expoURL: string) {
        // Expo application automatically detects Expo URLs in the clipboard
        // So we are copying expoURL to system clipboard and click on the special "Open from Clipboard" UI element
        const exploreElement = await client.$("//android.widget.TextView[@text='Projects']");
        await exploreElement.waitForExist({ timeout: SmokeTestsConstants.waitForElementTimeout });
        await exploreElement.click();

        SmokeTestLogger.info(`*** Pressing "Projects" icon...`);

        SmokeTestLogger.info(`*** Opening Expo app via clipboard`);
        SmokeTestLogger.info(`*** Copying ${expoURL} to system clipboard...`);
        clipboardy.writeSync(expoURL);
        const expoOpenFromClipboard = await client.$("//*[@text='Open from Clipboard']");
        SmokeTestLogger.info(
            `*** Searching for ${expoOpenFromClipboard.selector} element for click...`,
        );
        // Run Expo app by expoURL
        await expoOpenFromClipboard.waitForExist({
            timeout: SmokeTestsConstants.waitForElementTimeout,
        });

        await expoOpenFromClipboard.click();
        SmokeTestLogger.info(`*** ${expoOpenFromClipboard.selector} clicked...`);
    }

    private static async openExpoAppViaExpoXDLAndroidFunction(
        client: AppiumClient,
        projectFolder: string,
    ) {
        SmokeTestLogger.info(`*** Opening Expo app via XDL.Android function`);
        SmokeTestLogger.info(`*** Searching for the "Explore" button...`);
        const exploreElement = await client.$("//android.widget.TextView[@text='Projects']");
        await exploreElement.waitForExist({ timeout: SmokeTestsConstants.waitForElementTimeout });

        await XDL.Android.openProjectAsync({ projectRoot: projectFolder });
    }

    private static async openExpoAppViaExpoXDLSimulatorFunction(
        client: AppiumClient,
        projectFolder: string,
        firstLaunch?: boolean,
    ) {
        SmokeTestLogger.info(`*** Opening Expo app via XDL.Simulator function`);
        SmokeTestLogger.info(`*** Searching for the "Explore" button...`);

        const exploreElement = await client.$(
            `//XCUIElementTypeButton[@name="Explore, tab, 2 of 4"]`,
        );
        await exploreElement.waitForExist({ timeout: SmokeTestsConstants.waitForElementTimeout });

        await XDL.Simulator.openProjectAsync({ projectRoot: projectFolder });

        if (firstLaunch) {
            // it's required to allow launch of an Expo application when it's launched for the first time
            SmokeTestLogger.info(`*** First launch of Expo app`);
            SmokeTestLogger.info(`*** Pressing "Open" button...`);

            const openButton = await client.$(`//XCUIElementTypeButton[@name="Open"]`);

            await openButton.waitForExist({ timeout: 10 * 1000 });
            await openButton.click();
        }
    }
}
