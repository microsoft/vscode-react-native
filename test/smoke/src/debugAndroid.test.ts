// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SpectronApplication } from "./spectron/application";
import * as assert from "assert";
import { AppiumHelper } from "./helpers/appiumHelper";
import { AndroidEmulatorHelper } from "./helpers/androidEmulatorHelper";
import { sleep } from "./helpers/utilities";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { ExpoWorkspacePath, pureRNWorkspacePath } from "./main";

const RN_APP_PACKAGE_NAME = "com.latestrnapp";
const RN_APP_ACTIVITY_NAME = "com.latestrnapp.MainActivity";
const EXPO_APP_PACKAGE_NAME = AndroidEmulatorHelper.expoPackageName;
const EXPO_APP_ACTIVITY_NAME = `${EXPO_APP_PACKAGE_NAME}.experience.HomeActivity`;
const RNDebugConfigName = "Debug Android";
const ExpoDebugConfigName = "Debug in Exponent";
// Time for Android Debug Test before it reaches timeout
const debugAndroidTestTime = SmokeTestsConstants.androidAppBuildAndInstallTimeout + 100 * 1000;
// Time for Android Expo Debug Test before it reaches timeout
const debugExpoTestTime = SmokeTestsConstants.expoAppBuildAndInstallTimeout + 400 * 1000;

export function setup() {
    describe("Debugging Android", () => {
        before(async function () {
            const app = this.app as SpectronApplication;
            app.suiteName = "Debugging Android";
        });

        it("RN app Debug test", async function () {
            this.timeout(debugAndroidTestTime);
            const app = this.app as SpectronApplication;
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.runCommand("cursorTop");
            console.log("Android Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(23);
            console.log("Android Debug test: Breakpoint is set on line 23");
            await app.workbench.debug.openDebugViewlet();
            await app.workbench.debug.chooseDebugConfiguration(RNDebugConfigName);
            console.log(`Android Debug test: Chosen debug configuration: ${RNDebugConfigName}`);
            console.log("Android Debug test: Starting debugging");
            await app.workbench.debug.startDebugging();
            const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(RN_APP_PACKAGE_NAME, RN_APP_ACTIVITY_NAME,
            SmokeTestsConstants.defaultTargetAndroidPlatformVersion, AndroidEmulatorHelper.androidEmulatorName);
            await AndroidEmulatorHelper.checkIfAppIsInstalled(RN_APP_PACKAGE_NAME, SmokeTestsConstants.androidAppBuildAndInstallTimeout);
            let client = AppiumHelper.webdriverAttach(opts);
            let clientInited = client.init();
            await AppiumHelper.enableRemoteDebugJSForRNAndroid(clientInited);
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("Android Debug test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === 23, "looking for App.js and line 23");
            console.log("Android Debug test: Stack frame found");
            await app.workbench.debug.continue();
            // await for our debug string renders in debug console
            await sleep(500);
            console.log("Android Debug test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.findStringInConsole("Test output from debuggee", 10000);
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            console.log("Android Debug test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.stopDebugging();
            console.log("Android Debug test: Debugging is stopped");
            clientInited.closeApp();
            clientInited.endAll();
        });

        it("Expo app Debug test", async function () {
            this.timeout(debugExpoTestTime);
            const app = this.app as SpectronApplication;
            await app.restart({workspaceOrFolder: ExpoWorkspacePath});
            console.log(`Android Expo Debug test: ${ExpoWorkspacePath} directory is opened in VS Code`);
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.runCommand("cursorTop");
            console.log("Android Expo Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(12);
            console.log("Android Expo Debug test: Breakpoint is set on line 12");
            await app.workbench.debug.openDebugViewlet();
            console.log(`Android Expo Debug test: Chosen debug configuration: ${ExpoDebugConfigName}`);
            await app.workbench.debug.chooseDebugConfiguration(ExpoDebugConfigName);
            console.log("Android Expo Debug test: Starting debugging");
            await app.workbench.debug.startDebugging();
            await app.workbench.waitForTab("Expo QR Code");
            await app.workbench.waitForActiveTab("Expo QR Code");
            console.log("Android Expo Debug test: 'Expo QR Code' tab found");
            await app.workbench.selectTab("Expo QR Code");
            console.log("Android Expo Debug test: 'Expo QR Code' tab selected");
            let expoURL;
            for (let retries = 0; retries < 5; retries++) {
                await app.workbench.selectTab("Expo QR Code");
                expoURL = await app.workbench.debug.prepareExpoURLToClipboard();
                if (expoURL) break;
            }
            assert.notStrictEqual(expoURL, null, "Expo URL pattern is not found in the clipboard");
            expoURL = expoURL as string;
            const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(EXPO_APP_PACKAGE_NAME, EXPO_APP_ACTIVITY_NAME,
            SmokeTestsConstants.defaultTargetAndroidPlatformVersion, AndroidEmulatorHelper.androidEmulatorName);
            let client = AppiumHelper.webdriverAttach(opts);
            let clientInited = client.init();
            // TODO Add listener to trigger that main expo app has been ran
            await AppiumHelper.openExpoApplicationAndroid(clientInited, expoURL);
            // TODO Add listener to trigger that child expo app has been ran instead of using timeout
            console.log(`Android Expo Debug test: Waiting ${SmokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`);
            await sleep(SmokeTestsConstants.expoAppBuildAndInstallTimeout);
            await AppiumHelper.enableRemoteDebugJSForRNAndroid(clientInited);
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("Android Expo Debug test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === 12, "looking for App.js and line 12");
            console.log("Android Expo Debug test: Stack frame found");
            await app.workbench.debug.continue();
            await app.workbench.debug.continue(); // second continue() is needed because BP is being hit for two times for unknown reason
            // Wait for debug string to be rendered in debug console
            await sleep(10 * 1000);
            console.log("Android Expo Debug test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.findStringInConsole("Test output from debuggee", 10 * 1000);
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            console.log("Android Expo Debug test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.stopDebugging();
            console.log("Android Expo Debug test: Debugging is stopped");
            clientInited.closeApp();
            clientInited.endAll();
        });

        it("Pure RN app Expo test", async function () {
            this.timeout(debugExpoTestTime);
            const app = this.app as SpectronApplication;
            await app.restart({workspaceOrFolder: pureRNWorkspacePath});
            console.log(`Android pure RN Expo test: ${pureRNWorkspacePath} directory is opened in VS Code`);
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.runCommand("cursorTop");
            console.log("Android pure RN Expo test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(23);
            console.log("Android pure RN Expo test: Breakpoint is set on line 23");
            await app.workbench.debug.openDebugViewlet();
            console.log(`Android pure RN Expo test: Chosen debug configuration: ${ExpoDebugConfigName}`);
            await app.workbench.debug.chooseDebugConfiguration(ExpoDebugConfigName);
            console.log("Android pure RN Expo test: Starting debugging");
            await app.workbench.debug.startDebugging();
            await app.workbench.waitForTab("Expo QR Code");
            await app.workbench.waitForActiveTab("Expo QR Code");
            console.log("Android pure RN Expo test: 'Expo QR Code' tab found");
            await app.workbench.selectTab("Expo QR Code");
            console.log("Android pure RN Expo test: 'Expo QR Code' tab selected");
            let expoURL;
            for (let retries = 0; retries < 5; retries++) {
                await app.workbench.selectTab("Expo QR Code");
                expoURL = await app.workbench.debug.prepareExpoURLToClipboard();
                if (expoURL) break;
            }
            assert.notStrictEqual(expoURL, null, "Expo URL pattern is not found in the clipboard");
            expoURL = expoURL as string;
            const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(EXPO_APP_PACKAGE_NAME, EXPO_APP_ACTIVITY_NAME,
            SmokeTestsConstants.defaultTargetAndroidPlatformVersion, AndroidEmulatorHelper.androidEmulatorName);
            let client = AppiumHelper.webdriverAttach(opts);
            let clientInited = client.init();
            await AppiumHelper.openExpoApplicationAndroid(clientInited, expoURL);
            console.log(`Android pure RN Expo test: Waiting ${SmokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`);
            await sleep(SmokeTestsConstants.expoAppBuildAndInstallTimeout);
            await AppiumHelper.enableRemoteDebugJSForRNAndroid(clientInited);
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("Android pure RN Expo test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === 23, "looking for App.js and line 23");
            console.log("Android pure RN Expo test: Stack frame found");
            await app.workbench.debug.continue();
            // Wait for debug string to be rendered in debug console
            await sleep(10 * 1000);
            console.log("Android pure RN Expo test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.findStringInConsole("Test output from debuggee", 10 * 1000);
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            console.log("Android pure RN Expo test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.stopDebugging();
            console.log("Android pure RN Expo test: Debugging is stopped");
            clientInited.closeApp();
            clientInited.endAll();
        });
    });
}
