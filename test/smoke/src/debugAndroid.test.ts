// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SpectronApplication } from "./spectron/application";
import * as assert from "assert";
import { appiumHelper } from "./helpers/appiumHelper";
import { androidEmulatorName, sleep, expoPackageName } from "./helpers/setupEnvironmentHelper";
import { smokeTestsConstants } from "./helpers/smokeTestsConstants";
import { ExpoWorkspacePath } from "./main";
import * as clipboardy from "clipboardy";

const RN_APP_PACKAGE_NAME = "com.latestrnapp";
const RN_APP_ACTIVITY_NAME = "com.latestrnapp.MainActivity";
const EXPO_APP_PACKAGE_NAME = expoPackageName;
const EXPO_APP_ACTIVITY_NAME = `${EXPO_APP_PACKAGE_NAME}.experience.HomeActivity`;
const RNDebugConfigName = "Debug Android";
const ExpoDebugConfigName = "Debug in Exponent";
// Time for Android Debug Test before it reach timeout
const debugAndroidTestTime = smokeTestsConstants.androidAppBuildAndInstallTimeout + 100 * 1000;
// Time for Android Expo Debug Test before it reach timeout
const debugExpoTestTime = smokeTestsConstants.expoAppBuildAndInstallTimeout + 300 * 1000;

// Function getting Expo URL from VS Code Expo QR Code tab
// For correct work opened and selected Expo QR Code tab is needed
async function prepareExpoURLToClipboard(app: SpectronApplication) {
    await sleep(2000);
    await app.runCommand("editor.action.webvieweditor.selectAll");
    console.log("Expo QR Code tab text prepared to be copied");
    await sleep(1000);
    await app.runCommand("editor.action.clipboardCopyAction");
    await sleep(2000);
    let clipboard = clipboardy.readSync();
    console.log(`Expo QR Code tab text copied: \n ${clipboard}`);
    clipboard = clipboard.match(/^exp:\/\/\d+\.\d+\.\d+\.\d+\:\d+$/gm);
    assert.notStrictEqual(clipboard, null, "Expo URL pattern is not found in the clipboard");
    let expoURL = clipboard[0];
    console.log(`Found Expo URL: ${expoURL}`);
    return expoURL;
}

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
            console.log("Android Debug test: starting debugging");
            await app.workbench.debug.startDebugging();
            const opts = appiumHelper.prepareAttachOptsForAndroidActivity(RN_APP_PACKAGE_NAME, RN_APP_ACTIVITY_NAME,
            smokeTestsConstants.defaultTargetAndroidPlatformVersion, androidEmulatorName);
            await appiumHelper.checkAppIsInstalled(RN_APP_PACKAGE_NAME, smokeTestsConstants.androidAppBuildAndInstallTimeout);
            let client = appiumHelper.webdriverAttach(opts);
            let clientInited = client.init();
            await appiumHelper.enableRemoteDebugJSForRNAndroid(clientInited);
            console.log("Android Debug test: debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === 23, "looking for App.js and line 23");
            console.log("Android Debug test: stack frame found");
            await app.workbench.debug.continue();
            // await for our debug string renders in debug console
            await sleep(500);
            let result = await app.workbench.debug.getConsoleOutput();
            let testOutputIndex = result.indexOf("Test output from debuggee");
            assert.notStrictEqual(testOutputIndex, -1, "\"Test output from debuggee\" string is not contains in debug console");
            await app.workbench.debug.stopDebugging();
            client.closeApp();
            client.endAll();
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
            console.log("Android Expo Debug test: starting debugging");
            await app.workbench.debug.startDebugging();
            await app.workbench.waitForTab("Expo QR Code");
            await app.workbench.waitForActiveTab("Expo QR Code");
            console.log("Android Expo Debug test: 'Expo QR Code' tab found");
            await app.workbench.selectTab("Expo QR Code", false, false);
            console.log("Android Expo Debug test: 'Expo QR Code' tab selected");
            let expoURL = await prepareExpoURLToClipboard(app);
            const opts = appiumHelper.prepareAttachOptsForAndroidActivity(EXPO_APP_PACKAGE_NAME, EXPO_APP_ACTIVITY_NAME,
            smokeTestsConstants.defaultTargetAndroidPlatformVersion, androidEmulatorName);
            let client = appiumHelper.webdriverAttach(opts);
            let clientInited = client.init();
            await appiumHelper.openExpoApplicationAndroid(clientInited, expoURL);
            console.log(`*** Waiting ${smokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`);
            await sleep(smokeTestsConstants.expoAppBuildAndInstallTimeout);
            await appiumHelper.enableRemoteDebugJSForRNAndroid(clientInited);
            await sleep(smokeTestsConstants.expoAppBuildAndInstallTimeout);
            await appiumHelper.reloadRNAppAndroid(clientInited);
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === 12, "looking for App.js and line 12");
            console.log("Android Expo Debug test: stack frame found");
            await app.workbench.debug.continue();
            // await for our debug string renders in debug console
            await sleep(1000);
            let result = await app.workbench.debug.getConsoleOutput();
            let testOutputIndex = result.indexOf("Test output from debuggee");
            assert.notStrictEqual(testOutputIndex, -1, "\"Test output from debuggee\" string is not contains in debug console");
            await app.workbench.debug.stopDebugging();
            client.closeApp();
            client.endAll();
        });
    });
}
