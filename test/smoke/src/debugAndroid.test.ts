// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SpectronApplication } from "./spectron/application";
import * as assert from "assert";
import { appiumHelper } from "./helpers/appiumHelper";
import { androidEmulatorName, sleep, expoPackageName } from "./helpers/setupEnvironmentHelper";
import { smokeTestsConstants } from "./helpers/smokeTestsConstants";
import { ExpoWorkspacePath } from "./main";

const RN_APP_PACKAGE_NAME = "com.latestrnapp";
const RN_APP_ACTIVITY_NAME = "com.latestrnapp.MainActivity";
const EXPO_APP_PACKAGE_NAME = expoPackageName;
const EXPO_APP_ACTIVITY_NAME = `${EXPO_APP_PACKAGE_NAME}.experience.HomeActivity`;
const RNDebugConfigName = "Debug Android";
const ExpoDebugConfigName = "Debug in Exponent";
// Time for Android Debug Test before it reach timeout
const debugAndroidTestTime = 200 * 1000;
// Time for Android Expo Debug Test before it reach timeout
const debugExpoTestTime = 200 * 1000;
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
            await app.workbench.debug.chooseDebugConfiguration(RNDebugConfigName);
            console.log(`Android Debug test: Chosen debug configuration: ${RNDebugConfigName}`);
            await app.workbench.debug.openDebugViewlet();
            console.log("Android Debug test: starting debugging");
            await app.workbench.debug.startDebugging();
            const opts = appiumHelper.prepareAttachOptsForAndroidActivity(RN_APP_PACKAGE_NAME, RN_APP_ACTIVITY_NAME,
            smokeTestsConstants.defaultTargetAndroidPlatformVersion, androidEmulatorName);
            await appiumHelper.checkAppIsInstalled(RN_APP_PACKAGE_NAME, smokeTestsConstants.androidAppBuildAndInstallTimeout);
            let client = appiumHelper.webdriverAttach(opts);
            await appiumHelper.enableRemoteDebugJSForRNAndroid(client);
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
            client.end();
        });

        it("Android Expo Debug test", async function () {
            this.timeout(debugExpoTestTime);
            const app = this.app as SpectronApplication;
            await app.restart({workspaceOrFolder: ExpoWorkspacePath});
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.runCommand("cursorTop");
            console.log("Android Expo Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(21);
            console.log("Android Expo test: Breakpoint is set on line 21");
            await app.workbench.debug.openDebugViewlet();
            console.log(`Android Expo test: Chosen debug configuration: ${ExpoDebugConfigName}`);
            await app.workbench.debug.chooseDebugConfiguration(ExpoDebugConfigName);
            console.log("Android Expo test: starting debugging");
            await app.workbench.debug.startDebugging();
            const opts = appiumHelper.prepareAttachOptsForAndroidActivity(EXPO_APP_PACKAGE_NAME, EXPO_APP_ACTIVITY_NAME,
            smokeTestsConstants.defaultTargetAndroidPlatformVersion, androidEmulatorName);
            let client = appiumHelper.webdriverAttach(opts);
            await appiumHelper.enableRemoteDebugJSForRNAndroid(client);
            client.end();
        });
    });
}