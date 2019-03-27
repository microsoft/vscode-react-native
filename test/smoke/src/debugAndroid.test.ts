// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SpectronApplication } from "./spectron/application";
import * as assert from "assert";
import { appiumHelper } from "./helpers/appiumHelper";
import { androidEmulatorName, sleep, expoPackageName } from "./helpers/setupEnvironmentHelper";
import { smokeTestsConstants } from "./helpers/smokeTestsConstants";
import { ExpoWorkspacePath, pureRNWorkspacePath } from "./main";

const RN_APP_PACKAGE_NAME = "com.latestrnapp";
const RN_APP_ACTIVITY_NAME = "com.latestrnapp.MainActivity";
const EXPO_APP_PACKAGE_NAME = expoPackageName;
const EXPO_APP_ACTIVITY_NAME = `${EXPO_APP_PACKAGE_NAME}.experience.HomeActivity`;
const RNDebugConfigName = "Debug Android";
const ExpoDebugConfigName = "Debug in Exponent";
// Time for Android Debug Test before it reaches timeout
const debugAndroidTestTime = smokeTestsConstants.androidAppBuildAndInstallTimeout + 100 * 1000;
// Time for Android Expo Debug Test before it reaches timeout
const debugExpoTestTime = smokeTestsConstants.expoAppBuildAndInstallTimeout + 400 * 1000;

export function setup() {
    describe("Android debugging tests", () => {
        before(async function () {
            const app = this.app as SpectronApplication;
            app.suiteName = "Android debugging tests";
        });

        it("Android React Native Debug test", async function () {
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
            const opts = appiumHelper.prepareAttachOptsForAndroidActivity(RN_APP_PACKAGE_NAME, RN_APP_ACTIVITY_NAME,
            smokeTestsConstants.defaultTargetAndroidPlatformVersion, androidEmulatorName);
            await appiumHelper.checkIfAppIsInstalled(RN_APP_PACKAGE_NAME, smokeTestsConstants.androidAppBuildAndInstallTimeout);
            let client = appiumHelper.webdriverAttach(opts);
            let clientInited = client.init();
            await appiumHelper.enableRemoteDebugJSForRNAndroid(clientInited);
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

        it("Android Expo Debug test", async function () {
            this.timeout(debugExpoTestTime);
            const app = this.app as SpectronApplication;
            await app.restart({workspaceOrFolder: ExpoWorkspacePath});
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
            let expoURL = await app.workbench.debug.prepareExpoURLToClipboard();
            assert.notStrictEqual(expoURL, null, "Expo URL pattern is not found in the clipboard");
            expoURL = expoURL as string;
            const opts = appiumHelper.prepareAttachOptsForAndroidActivity(EXPO_APP_PACKAGE_NAME, EXPO_APP_ACTIVITY_NAME,
            smokeTestsConstants.defaultTargetAndroidPlatformVersion, androidEmulatorName);
            let client = appiumHelper.webdriverAttach(opts);
            let clientInited = client.init();
            // TODO Add listener to trigger that main expo app has been ran
            await appiumHelper.openExpoApplicationAndroid(clientInited, expoURL);
            // TODO Add listener to trigger that child expo app has been ran instead of using timeout
            console.log(`Android Expo Debug test: Waiting ${smokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`);
            await sleep(smokeTestsConstants.expoAppBuildAndInstallTimeout);
            await appiumHelper.enableRemoteDebugJSForRNAndroid(clientInited);
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

        it("Android pure RN Expo test", async function () {
            this.timeout(debugExpoTestTime);
            const app = this.app as SpectronApplication;
            await app.restart({workspaceOrFolder: pureRNWorkspacePath});
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
            let expoURL = await app.workbench.debug.prepareExpoURLToClipboard();
            assert.notStrictEqual(expoURL, null, "Expo URL pattern is not found in the clipboard");
            expoURL = expoURL as string;
            const opts = appiumHelper.prepareAttachOptsForAndroidActivity(EXPO_APP_PACKAGE_NAME, EXPO_APP_ACTIVITY_NAME,
            smokeTestsConstants.defaultTargetAndroidPlatformVersion, androidEmulatorName);
            let client = appiumHelper.webdriverAttach(opts);
            let clientInited = client.init();
            await appiumHelper.openExpoApplicationAndroid(clientInited, expoURL);
            console.log(`Android pure RN Expo test: Waiting ${smokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`);
            await sleep(smokeTestsConstants.expoAppBuildAndInstallTimeout);
            await appiumHelper.enableRemoteDebugJSForRNAndroid(clientInited);
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
