// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SpectronApplication } from "./spectron/application";
import * as assert from "assert";
import { AppiumHelper, Platform, AppiumClient } from "./helpers/appiumHelper";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { RNworkspacePath, runVSCode, ExpoWorkspacePath, pureRNWorkspacePath } from "./main";
import { IosSimulatorHelper } from "./helpers/iosSimulatorHelper";
import { sleep, findFile } from "./helpers/utilities";
import { SetupEnvironmentHelper } from "./helpers/setupEnvironmentHelper";
import * as path from "path";
import { TestRunArguments } from "./helpers/configHelper";

const RnAppBundleId = "org.reactjs.native.example.latestRNApp";
const RNDebugConfigName = "Debug iOS";
const ExpoDebugConfigName = "Debug in Exponent";

const RNSetBreakpointOnLine = 1;
const ExpoSetBreakpointOnLine = 1;
const PureRNExpoSetBreakpointOnLine = 1;
// Time for OS Debug Test before it reaches timeout
const debugIosTestTime = SmokeTestsConstants.iosAppBuildAndInstallTimeout + 100 * 1000;
// Time for iOS Expo Debug Test before it reaches timeout
const debugExpoTestTime = SmokeTestsConstants.expoAppBuildAndInstallTimeout + 400 * 1000;

export function setup(testParameters?: TestRunArguments) {
    describe("Debugging iOS", () => {
        let app: SpectronApplication;
        let clientInited: AppiumClient;

        afterEach(async () => {
            await app.stop();
            if (clientInited) {
                clientInited.closeApp();
                clientInited.endAll();
            }
        });

        it("RN app Debug test", async function () {
            this.timeout(debugIosTestTime);
            app = await runVSCode(RNworkspacePath);
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.runCommand("cursorTop");
            console.log("iOS Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(RNSetBreakpointOnLine);
            console.log(`iOS Debug test: Breakpoint is set on line ${RNSetBreakpointOnLine}`);
            await app.workbench.debug.openDebugViewlet();
            await app.workbench.debug.chooseDebugConfiguration(RNDebugConfigName);
            console.log(`iOS Debug test: Chosen debug configuration: ${RNDebugConfigName}`);
            // We need to implicitly add target to "Debug iOS" configuration to avoid running additional simulator
            SetupEnvironmentHelper.addIosTargetToLaunchJson(RNworkspacePath);
            console.log("iOS Debug test: Starting debugging");
            await app.workbench.debug.startDebugging();
            await IosSimulatorHelper.waitUntilIosAppIsInstalled(RnAppBundleId, SmokeTestsConstants.iosAppBuildAndInstallTimeout, 40 * 1000);
            // Sometimes by this moment iOS app already have remote js debugging enabled so we don't need to enable it manually
            if (!await app.workbench.debug.areStackFramesExist()) {
                const device = <string>IosSimulatorHelper.getDevice();
                const appPath = `${RNworkspacePath}/ios/build/${SmokeTestsConstants.RNAppName}/Build/Products/Debug-iphonesimulator/${SmokeTestsConstants.RNAppName}.app`;
                const opts = AppiumHelper.prepareAttachOptsForIosApp(device, appPath);
                let client = AppiumHelper.webdriverAttach(opts);
                clientInited = client.init();
                await AppiumHelper.enableRemoteDebugJS(clientInited, Platform.iOS);
                await sleep(5 * 1000);
            }
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("iOS Debug test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === RNSetBreakpointOnLine, `looking for App.js and line ${RNSetBreakpointOnLine}`);
            console.log("iOS Debug test: Stack frame found");
            await app.workbench.debug.continue();
            // Wait for our debug string to render in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            console.log("iOS Debug test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.findStringInConsole("Test output from debuggee", 10 * 1000);
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            console.log("iOS Debug test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.stopDebugging();
            console.log("iOS Debug test: Debugging is stopped");
        });

        it("Expo app Debug test", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            app = await runVSCode(ExpoWorkspacePath);
            console.log(`iOS Expo Debug test: ${ExpoWorkspacePath} directory is opened in VS Code`);
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.runCommand("cursorTop");
            console.log("iOS Expo Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(ExpoSetBreakpointOnLine);
            console.log(`iOS Expo Debug test: Breakpoint is set on line ${ExpoSetBreakpointOnLine}`);
            await app.workbench.debug.openDebugViewlet();
            console.log(`iOS Expo Debug test: Chosen debug configuration: ${ExpoDebugConfigName}`);
            await app.workbench.debug.chooseDebugConfiguration(ExpoDebugConfigName);
            // We need to implicitly add target to "Debug iOS" configuration to avoid running additional simulator
            SetupEnvironmentHelper.addIosTargetToLaunchJson(RNworkspacePath);
            console.log("iOS Expo Debug test: Starting debugging");
            await app.workbench.debug.startDebugging();
            const device = <string>IosSimulatorHelper.getDevice();
            await sleep(5 * 1000);
            await app.workbench.waitForTab("Expo QR Code");
            await app.workbench.waitForActiveTab("Expo QR Code");
            console.log("iOS Expo Debug test: 'Expo QR Code' tab found");
            await app.workbench.selectTab("Expo QR Code");
            console.log("iOS Expo Debug test: 'Expo QR Code' tab selected");
            let expoURL;
            for (let retries = 0; retries < 5; retries++) {
                await app.workbench.selectTab("Expo QR Code");
                expoURL = await app.workbench.debug.prepareExpoURLToClipboard();
                if (expoURL) break;
            }
            assert.notStrictEqual(expoURL, null, "Expo URL pattern is not found in the clipboard");
            expoURL = expoURL as string;
            let appFile = findFile(SetupEnvironmentHelper.iOSExpoAppsCacheDir, /.*\.(app)/);
            if (!appFile) {
                throw new Error(`iOS Expo app is not found in ${SetupEnvironmentHelper.iOSExpoAppsCacheDir}`);
            }
            const appPath = path.join(SetupEnvironmentHelper.iOSExpoAppsCacheDir, appFile);
            const opts = AppiumHelper.prepareAttachOptsForIosApp(device, appPath);
            let client = AppiumHelper.webdriverAttach(opts);
            clientInited = client.init();
            await AppiumHelper.openExpoApplication(Platform.iOS, clientInited, app.client.spectron.electron.clipboard, expoURL);
            console.log(`iOS Expo Debug test: Waiting ${SmokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`);
            await sleep(SmokeTestsConstants.expoAppBuildAndInstallTimeout);
            // Sometimes by this moment iOS app already have remote js debugging enabled so we don't need to enable it manually
            if (!await app.workbench.debug.areStackFramesExist()) {
                await AppiumHelper.disableExpoErrorRedBox(clientInited);
                await AppiumHelper.disableDevMenuInformationalMsg(clientInited);
                await AppiumHelper.enableRemoteDebugJS(clientInited, Platform.iOS_Expo);
                await sleep(5 * 1000);
            }
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("iOS Expo Debug test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === ExpoSetBreakpointOnLine, `looking for App.js and line ${ExpoSetBreakpointOnLine}`);
            console.log("iOS Expo Debug test: Stack frame found");
            await app.workbench.debug.continue();
            // Wait for our debug string to render in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            console.log("iOS Expo Debug test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.findStringInConsole("Test output from debuggee", 10 * 1000);
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            console.log("iOS Expo Debug test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.stopDebugging();
            console.log("iOS Expo Debug test: Debugging is stopped");
        });

        it("Pure RN app Expo test", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            app = await runVSCode(pureRNWorkspacePath);
            console.log(`iOS pure RN Expo test: ${pureRNWorkspacePath} directory is opened in VS Code`);
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.runCommand("cursorTop");
            console.log("iOS pure RN Expo test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(PureRNExpoSetBreakpointOnLine);
            console.log(`iOS pure RN Expo test: Breakpoint is set on line ${PureRNExpoSetBreakpointOnLine}`);
            await app.workbench.debug.openDebugViewlet();
            console.log(`iOS pure RN Expo test: Chosen debug configuration: ${ExpoDebugConfigName}`);
            await app.workbench.debug.chooseDebugConfiguration(ExpoDebugConfigName);
            // We need to implicitly add target to "Debug iOS" configuration to avoid running additional simulator
            SetupEnvironmentHelper.addIosTargetToLaunchJson(pureRNWorkspacePath);
            console.log("iOS pure RN Expo test: Starting debugging");
            await app.workbench.debug.startDebugging();
            const device = <string>IosSimulatorHelper.getDevice();
            await sleep(5 * 1000);
            await app.workbench.waitForTab("Expo QR Code");
            await app.workbench.waitForActiveTab("Expo QR Code");
            console.log("iOS pure RN Expo test: 'Expo QR Code' tab found");
            await app.workbench.selectTab("Expo QR Code");
            console.log("iOS pure RN Expo test: 'Expo QR Code' tab selected");
            let expoURL;
            for (let retries = 0; retries < 5; retries++) {
                await app.workbench.selectTab("Expo QR Code");
                expoURL = await app.workbench.debug.prepareExpoURLToClipboard();
                if (expoURL) break;
            }
            assert.notStrictEqual(expoURL, null, "Expo URL pattern is not found in the clipboard");
            expoURL = expoURL as string;
            let appFile = findFile(SetupEnvironmentHelper.iOSExpoAppsCacheDir, /.*\.(app)/);
            if (!appFile) {
                throw new Error(`iOS Expo app is not found in ${SetupEnvironmentHelper.iOSExpoAppsCacheDir}`);
            }
            const appPath = path.join(SetupEnvironmentHelper.iOSExpoAppsCacheDir, appFile);
            const opts = AppiumHelper.prepareAttachOptsForIosApp(device, appPath);
            let client = AppiumHelper.webdriverAttach(opts);
            clientInited = client.init();
            await AppiumHelper.openExpoApplication(Platform.iOS, clientInited, app.client.spectron.electron.clipboard, expoURL);
            console.log(`iOS pure RN Expo test: Waiting ${SmokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`);
            await sleep(SmokeTestsConstants.expoAppBuildAndInstallTimeout);
            // Sometimes by this moment iOS app already have remote js debugging enabled so we don't need to enable it manually
            if (!await app.workbench.debug.areStackFramesExist()) {
                await AppiumHelper.disableExpoErrorRedBox(clientInited);
                await AppiumHelper.disableDevMenuInformationalMsg(clientInited);
                await AppiumHelper.enableRemoteDebugJS(clientInited, Platform.iOS_Expo);
                await sleep(5 * 1000);
            }
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("iOS pure RN Expo test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === PureRNExpoSetBreakpointOnLine, `looking for App.js and line ${PureRNExpoSetBreakpointOnLine}`);
            console.log("iOS pure RN Expo test: Stack frame found");
            await app.workbench.debug.continue();
            // Wait for our debug string to render in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            console.log("iOS pure RN Expo test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.findStringInConsole("Test output from debuggee", 10 * 1000);
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            console.log("iOS pure RN Expo test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.stopDebugging();
            console.log("iOS pure RN Expo test: Debugging is stopped");
        });
    });
}
