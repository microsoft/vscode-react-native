// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SpectronApplication } from "./spectron/application";
import * as assert from "assert";
import { AppiumHelper, Platform } from "./helpers/appiumHelper";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { RNworkspacePath } from "./main";
import { IosSimulatorHelper } from "./helpers/iosSimulatorHelper";
import { Client, RawResult } from "webdriverio";
import { sleep, runInParallel } from "./helpers/utilities";
import { SetupEnvironmentHelper } from "./helpers/setupEnvironmentHelper";

const RN_APP_BUNDLE_ID = "org.reactjs.native.example.latestRNApp";
const RNDebugConfigName = "Debug iOS";
// const ExpoDebugConfigName = "Debug in Exponent";
// Time for OS Debug Test before it reaches timeout
const debugIosTestTime = SmokeTestsConstants.iosAppBuildAndInstallTimeout + 100 * 1000;
// Time for iOS Expo Debug Test before it reaches timeout
// const debugExpoTestTime = smokeTestsConstants.expoAppBuildAndInstallTimeout + 400 * 1000;
export function setup() {
    describe("Debugging iOS", () => {
        let clientInited: Client<RawResult<null>> & RawResult<null>;
        before(async function () {
            const app = this.app as SpectronApplication;
            app.suiteName = "Debugging iOS";
        });

        after(() => {
            if (clientInited) {
                clientInited.closeApp();
                clientInited.endAll();
            }
        });

        it("RN app Debug test", async function () {
            this.timeout(debugIosTestTime);
            const app = this.app as SpectronApplication;
            await app.restart({workspaceOrFolder: RNworkspacePath});
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.runCommand("cursorTop");
            console.log("iOS Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(23);
            console.log("iOS Debug test: Breakpoint is set on line 23");
            await app.workbench.debug.openDebugViewlet();
            await app.workbench.debug.chooseDebugConfiguration(RNDebugConfigName);
            console.log(`iOS Debug test: Chosen debug configuration: ${RNDebugConfigName}`);
            // We need to implicitly add target to "Debug iOS" configuration to avoid running additional simulator
            SetupEnvironmentHelper.addIosTargetToLaunchJson(RNworkspacePath);
            const waitUntilIosAppIsInstalled = AppiumHelper.waitUntilIosAppIsInstalled(RN_APP_BUNDLE_ID, SmokeTestsConstants.iosAppBuildAndInstallTimeout, 40 * 1000);
            const startDebugging = async () => {
                console.log("iOS Debug test: Starting debugging");
                await app.workbench.debug.startDebugging();
            };
            // We run these in parallel to avoid race condition
            await runInParallel([waitUntilIosAppIsInstalled, startDebugging()]);

            // Sometimes by this moment iOS app already have remote js debugging enabled so we don't need to enable it manually
            if (!await app.workbench.debug.areStackFramesExist()) {
                const device = <string>IosSimulatorHelper.getDevice();
                const appPath = `${RNworkspacePath}/ios/build/${SmokeTestsConstants.RNAppName}/Build/Products/Debug-iphonesimulator/${SmokeTestsConstants.RNAppName}.app`;
                const opts = AppiumHelper.prepareAttachOptsForiOSApp(device, appPath);
                let client = AppiumHelper.webdriverAttach(opts);
                let clientInited = client.init();
                await AppiumHelper.enableRemoteDebugJS(clientInited, Platform.iOS);
                await sleep(5 * 1000);
            }
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("iOS Debug test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === 23, "looking for App.js and line 23");
            console.log("iOS Debug test: Stack frame found");
            await app.workbench.debug.continue();
            // Wait for our debug string to render in debug console
            await sleep(500);
            console.log("iOS Debug test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.findStringInConsole("Test output from debuggee", 10000);
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            console.log("iOS Debug test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.stopDebugging();
            console.log("iOS Debug test: Debugging is stopped");
        });
    });
}
