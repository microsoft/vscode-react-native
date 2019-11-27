// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import { AppiumHelper, Platform, AppiumClient } from "./helpers/appiumHelper";
import { AndroidEmulatorHelper } from "./helpers/androidEmulatorHelper";
import { sleep, findStringInFile, findExpoURLInLogFile } from "./helpers/utilities";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { ExpoWorkspacePath, pureRNWorkspacePath, RNworkspacePath, prepareReactNativeProjectForHermesTesting, runVSCode } from "./main";
import { SetupEnvironmentHelper } from "./helpers/setupEnvironmentHelper";
import { TestRunArguments } from "./helpers/configHelper";
import { Application } from "../../automation";

const RN_APP_PACKAGE_NAME = "com.latestrnapp";
const RN_APP_ACTIVITY_NAME = "com.latestrnapp.MainActivity";
const EXPO_APP_PACKAGE_NAME = SetupEnvironmentHelper.expoPackageName;
const EXPO_APP_ACTIVITY_NAME = `${EXPO_APP_PACKAGE_NAME}.experience.HomeActivity`;
const RNDebugConfigName = "Debug Android";
const RNHermesDebugConfigName = "Debug Android (Hermes) - Experimental";
const RNHermesAttachConfigName = "Attach to Hermes application - Experimental";
const ExpoDebugConfigName = "Debug in Exponent";

const RNSetBreakpointOnLine = 1;
const RNHermesSetBreakpointOnLine = 11;
const ExpoSetBreakpointOnLine = 1;
const PureRNExpoSetBreakpointOnLine = 1;
// Time for Android Debug Test before it reaches timeout
const debugAndroidTestTime = SmokeTestsConstants.androidAppBuildAndInstallTimeout + 100 * 1000;
// Time for Android Expo Debug Test before it reaches timeout
const debugExpoTestTime = SmokeTestsConstants.expoAppBuildAndInstallTimeout + 400 * 1000;

export function setup(testParameters?: TestRunArguments) {
    describe("Debugging Android", () => {
        let app: Application;
        let clientInited: AppiumClient;

        afterEach(async () => {
            await app.stop();
            if (clientInited) {
                clientInited.closeApp();
                clientInited.endAll();
            }
        });

        it("RN app Debug test", async function () {
            this.timeout(debugAndroidTestTime);
            app = await runVSCode(RNworkspacePath);
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.workbench.editors.scrollTop();
            console.log("Android Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(RNSetBreakpointOnLine);
            console.log(`Android Debug test: Breakpoint is set on line ${RNSetBreakpointOnLine}`);
            await app.workbench.debug.openDebugViewlet();
            console.log(`Android Debug test: Chosen debug configuration: ${RNDebugConfigName}`);
            console.log("Android Debug test: Starting debugging");
            await app.workbench.debug.runDebugScenario(RNDebugConfigName);
            const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(RN_APP_PACKAGE_NAME, RN_APP_ACTIVITY_NAME, AndroidEmulatorHelper.androidEmulatorName);
            await AndroidEmulatorHelper.checkIfAppIsInstalled(RN_APP_PACKAGE_NAME, SmokeTestsConstants.androidAppBuildAndInstallTimeout);
            let client = AppiumHelper.webdriverAttach(opts);
            clientInited = client.init();
            await AppiumHelper.enableRemoteDebugJS(clientInited, Platform.Android);
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("Android Debug test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === RNSetBreakpointOnLine, `looking for App.js and line ${RNSetBreakpointOnLine}`);
            console.log("Android Debug test: Stack frame found");
            await app.workbench.debug.stepOver();
            // await for our debug string renders in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            console.log("Android Debug test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
            console.log(found);
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            console.log("Android Debug test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.stopDebugging();
            console.log("Android Debug test: Debugging is stopped");
        });

        it("Hermes RN app Debug test", async function () {
            this.timeout(debugAndroidTestTime);
            prepareReactNativeProjectForHermesTesting();
            AndroidEmulatorHelper.uninstallTestAppFromEmulator(RN_APP_PACKAGE_NAME);
            app = await runVSCode(RNworkspacePath);
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("AppTestButton.js");
            await app.workbench.editors.scrollTop();
            console.log("Android Debug Hermes test: AppTestButton.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(RNHermesSetBreakpointOnLine);
            console.log(`Android Debug Hermes test: Breakpoint is set on line ${RNHermesSetBreakpointOnLine}`);
            await app.workbench.debug.openDebugViewlet();
            console.log(`Android Debug Hermes test: Debug Viewlet opened`);
            console.log(`Android Debug Hermes test: Chosen debug configuration: ${RNHermesDebugConfigName}`);
            console.log("Android Debug Hermes test: Starting debugging");
            await app.workbench.debug.runDebugScenario(RNHermesDebugConfigName);
            const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(RN_APP_PACKAGE_NAME, RN_APP_ACTIVITY_NAME, AndroidEmulatorHelper.androidEmulatorName);
            await AndroidEmulatorHelper.checkIfAppIsInstalled(RN_APP_PACKAGE_NAME, SmokeTestsConstants.androidAppBuildAndInstallTimeout);
            let client = AppiumHelper.webdriverAttach(opts);
            clientInited = client.init();
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("Android Debug Hermes test: Debugging started");
            console.log("Android Debug Hermes test: Checking for Hermes mark");
            let isHermesWorking = await AppiumHelper.isHermesWorking(clientInited);
            assert.equal(isHermesWorking, true);
            console.log("Android Debug Hermes test: Reattaching to Hermes app");
            await app.workbench.debug.stopDebugging();
            await app.workbench.debug.runDebugScenario(RNHermesAttachConfigName);
            console.log("Android Debug Hermes test: Reattached successfully");
            await sleep(7000);
            console.log("Android Debug Hermes test: Click Test Button");
            await AppiumHelper.clickTestButtonHermes(clientInited);
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "AppTestButton.js" && sf.lineNumber === RNHermesSetBreakpointOnLine, `looking for AppTestButton.js and line ${RNHermesSetBreakpointOnLine}`);
            console.log("Android Debug Hermes test: Stack frame found");
            await app.workbench.debug.continue();
            // await for our debug string renders in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            if (process.env.REACT_NATIVE_TOOLS_LOGS_DIR) {
                console.log("Android Debug Hermes test: Searching for \"Test output from Hermes debuggee\" string in output file");
                let found = findStringInFile(path.join(process.env.REACT_NATIVE_TOOLS_LOGS_DIR, "ChromeDebugCoreLogs.txt"), "Test output from Hermes debuggee");
                assert.notStrictEqual(found, false, "\"Test output from Hermes debuggee\" string is missing in output file");
                console.log("Android Debug test: \"Test output from Hermes debuggee\" string is found");
            }
            await app.workbench.debug.disconnectFromDebugger();
            console.log("Android Debug Hermes test: Debugging is stopped");
        });

        it("Expo app Debug test", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            app = await runVSCode(ExpoWorkspacePath);
            console.log(`Android Expo Debug test: ${ExpoWorkspacePath} directory is opened in VS Code`);
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.workbench.editors.scrollTop();
            console.log("Android Expo Debug test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(ExpoSetBreakpointOnLine);
            console.log(`Android Expo Debug test: Breakpoint is set on line ${ExpoSetBreakpointOnLine}`);
            await app.workbench.debug.openDebugViewlet();
            console.log(`Android Expo Debug test: Chosen debug configuration: ${ExpoDebugConfigName}`);
            console.log("Android Expo Debug test: Starting debugging");
            await app.workbench.debug.runDebugScenario(ExpoDebugConfigName);
            await app.workbench.editors.waitForTab("Expo QR Code");
            await app.workbench.editors.waitForActiveTab("Expo QR Code");
            console.log("Android Expo Debug test: 'Expo QR Code' tab found");

            let expoURL;
            if (process.env.REACT_NATIVE_TOOLS_LOGS_DIR) {
                expoURL = findExpoURLInLogFile(path.join(process.env.REACT_NATIVE_TOOLS_LOGS_DIR, "ReactNativeRunexponent.txt"));
            }
            assert.notStrictEqual(expoURL, null, "Expo URL pattern is not found in the clipboard");
            expoURL = expoURL as string;
            const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(EXPO_APP_PACKAGE_NAME, EXPO_APP_ACTIVITY_NAME, AndroidEmulatorHelper.androidEmulatorName);
            let client = AppiumHelper.webdriverAttach(opts);
            clientInited = client.init();
            // TODO Add listener to trigger that main expo app has been ran
            await AppiumHelper.openExpoApplication(Platform.Android, clientInited, expoURL);
            // TODO Add listener to trigger that child expo app has been ran instead of using timeout
            console.log(`Android Expo Debug test: Waiting ${SmokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`);
            await sleep(SmokeTestsConstants.expoAppBuildAndInstallTimeout);
            await AppiumHelper.enableRemoteDebugJS(clientInited, Platform.Android);
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("Android Expo Debug test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === ExpoSetBreakpointOnLine, `looking for App.js and line ${ExpoSetBreakpointOnLine}`);
            console.log("Android Expo Debug test: Stack frame found");
            await app.workbench.debug.stepOver();
            // Wait for debug string to be rendered in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            console.log("Android Expo Debug test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            console.log("Android Expo Debug test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.stopDebugging();
            console.log("Android Expo Debug test: Debugging is stopped");
        });

        it("Pure RN app Expo test", async function () {
            if (testParameters && testParameters.RunBasicTests) {
                this.skip();
            }
            this.timeout(debugExpoTestTime);
            app = await runVSCode(pureRNWorkspacePath);
            console.log(`Android pure RN Expo test: ${pureRNWorkspacePath} directory is opened in VS Code`);
            await app.workbench.explorer.openExplorerView();
            await app.workbench.explorer.openFile("App.js");
            await app.workbench.editors.scrollTop();
            console.log("Android pure RN Expo test: App.js file is opened");
            await app.workbench.debug.setBreakpointOnLine(PureRNExpoSetBreakpointOnLine);
            console.log(`Android pure RN Expo test: Breakpoint is set on line ${PureRNExpoSetBreakpointOnLine}`);
            await app.workbench.debug.openDebugViewlet();
            console.log(`Android pure RN Expo test: Chosen debug configuration: ${ExpoDebugConfigName}`);
            console.log("Android pure RN Expo test: Starting debugging");
            await app.workbench.debug.runDebugScenario(ExpoDebugConfigName);
            await app.workbench.editors.waitForTab("Expo QR Code");
            await app.workbench.editors.waitForActiveTab("Expo QR Code");
            console.log("Android pure RN Expo test: 'Expo QR Code' tab found");

            let expoURL;
            if (process.env.REACT_NATIVE_TOOLS_LOGS_DIR) {
                expoURL = findExpoURLInLogFile(path.join(process.env.REACT_NATIVE_TOOLS_LOGS_DIR, "ReactNativeRunexponent.txt"));
            }

            assert.notStrictEqual(expoURL, null, "Expo URL pattern is not found in the clipboard");
            expoURL = expoURL as string;
            const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(EXPO_APP_PACKAGE_NAME, EXPO_APP_ACTIVITY_NAME, AndroidEmulatorHelper.androidEmulatorName);
            let client = AppiumHelper.webdriverAttach(opts);
            clientInited = client.init();
            await AppiumHelper.openExpoApplication(Platform.Android, clientInited, expoURL);
            console.log(`Android pure RN Expo test: Waiting ${SmokeTestsConstants.expoAppBuildAndInstallTimeout}ms until Expo app is ready...`);
            await sleep(SmokeTestsConstants.expoAppBuildAndInstallTimeout);
            await AppiumHelper.enableRemoteDebugJS(clientInited, Platform.Android);
            await app.workbench.debug.waitForDebuggingToStart();
            console.log("Android pure RN Expo test: Debugging started");
            await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === PureRNExpoSetBreakpointOnLine, `looking for App.js and line ${PureRNExpoSetBreakpointOnLine}`);
            console.log("Android pure RN Expo test: Stack frame found");
            await app.workbench.debug.stepOver();
            // Wait for debug string to be rendered in debug console
            await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
            console.log("Android pure RN Expo test: Searching for \"Test output from debuggee\" string in console");
            let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
            assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
            console.log("Android pure RN Expo test: \"Test output from debuggee\" string is found");
            await app.workbench.debug.stopDebugging();
            console.log("Android pure RN Expo test: Debugging is stopped");
        });
    });
}
