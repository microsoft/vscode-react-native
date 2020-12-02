// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { Application } from "../../automation";
import { LaunchConfigurationManager } from "./helpers/launchConfigurationManager";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import { sleep } from "./helpers/utilities";
import { androidEmulatorManager, iosSimulatorManager, vscodeManager } from "./main";

const RN_APP_PACKAGE_NAME = "com.latestrnapp";
const AndroidRNDebugConfigName = "Debug Android";

const RnAppBundleId = "org.reactjs.native.example.latestRNApp";
const IosRNDebugConfigName = "Debug iOS";

const RNSetBreakpointOnLine = 1;

// Time for Android Debug Test before it reaches timeout
const debugAndroidTestTime = SmokeTestsConstants.androidTestTimeout;
// Time for iOS Debug Test before it reaches timeout
const debugIosTestTime = SmokeTestsConstants.iosTestTimeout;


export function startReactNativeTests(workspace: string, testParameters: TestRunArguments): void {

    describe("React Native", () => {
        let app: Application;

        async function disposeAll() {
            SmokeTestLogger.info("Dispose all ...");
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await app.workbench.quickaccess.runCommand(SmokeTestsConstants.stopPackagerCommand);
                await sleep(3000);
                await app.stop();
            }
        }

        afterEach(disposeAll);

        // Android debug tests
        if (testParameters.RunAndroidTests || testParameters.RunBasicTests) {
            it("Android RN app Debug test", async function () {
                this.timeout(debugAndroidTestTime);
                app = await vscodeManager.runVSCode(workspace, "Android RN app Debug test");
                await app.workbench.quickaccess.openFile("App.js");
                await app.workbench.editors.scrollTop();
                SmokeTestLogger.info("Android Debug test: App.js file is opened");
                await app.workbench.debug.setBreakpointOnLine(RNSetBreakpointOnLine);
                SmokeTestLogger.info(`Android Debug test: Breakpoint is set on line ${RNSetBreakpointOnLine}`);
                SmokeTestLogger.info(`Android Debug test: Chosen debug configuration: ${AndroidRNDebugConfigName}`);
                SmokeTestLogger.info("Android Debug test: Starting debugging");
                await app.workbench.quickaccess.runDebugScenario(AndroidRNDebugConfigName);
                await androidEmulatorManager.waitUntilAppIsInstalled(RN_APP_PACKAGE_NAME);
                await app.workbench.debug.waitForDebuggingToStart();
                SmokeTestLogger.info("Android Debug test: Debugging started");
                await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === RNSetBreakpointOnLine, `looking for App.js and line ${RNSetBreakpointOnLine}`);
                SmokeTestLogger.info("Android Debug test: Stack frame found");
                await app.workbench.debug.stepOver();
                // await for our debug string renders in debug console
                await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                SmokeTestLogger.info("Android Debug test: Searching for \"Test output from debuggee\" string in console");
                let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
                assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
                SmokeTestLogger.success("Android Debug test: \"Test output from debuggee\" string is found");
                await app.workbench.debug.disconnectFromDebugger();
                SmokeTestLogger.info("Android Debug test: Debugging is stopped");
            });
        }

        // iOS debug tests
        if (process.platform === "darwin" && (testParameters.RunIosTests || testParameters.RunBasicTests)) {
            it("iOS RN app Debug test", async function () {
                if (process.platform !== "darwin") {
                    SmokeTestLogger.info(`iOS RN app Debug test: skip test if running not on macOS`);
                    return this.skip();
                }
                this.timeout(debugIosTestTime);
                const launchConfigurationManager = new LaunchConfigurationManager(workspace);
                const deviceName = iosSimulatorManager.getSimulator().name;
                app = await vscodeManager.runVSCode(workspace, "iOS RN app Debug test");
                await app.workbench.quickaccess.openFile("App.js");
                await app.workbench.editors.scrollTop();
                SmokeTestLogger.info("iOS Debug test: App.js file is opened");
                await app.workbench.debug.setBreakpointOnLine(RNSetBreakpointOnLine);
                SmokeTestLogger.info(`iOS Debug test: Breakpoint is set on line ${RNSetBreakpointOnLine}`);
                SmokeTestLogger.info(`iOS Debug test: Chosen debug configuration: ${IosRNDebugConfigName}`);
                // We need to implicitly add target to "Debug iOS" configuration to avoid running additional simulator
                launchConfigurationManager.updateLaunchScenario(IosRNDebugConfigName, { target: deviceName });
                SmokeTestLogger.info("iOS Debug test: Starting debugging");
                await app.workbench.quickaccess.runDebugScenario(IosRNDebugConfigName);
                await iosSimulatorManager.waitUntilIosAppIsInstalled(RnAppBundleId);
                await app.workbench.debug.waitForDebuggingToStart();
                SmokeTestLogger.info("iOS Debug test: Debugging started");
                await app.workbench.debug.waitForStackFrame(sf => sf.name === "App.js" && sf.lineNumber === RNSetBreakpointOnLine, `looking for App.js and line ${RNSetBreakpointOnLine}`);
                SmokeTestLogger.info("iOS Debug test: Stack frame found");
                await app.workbench.debug.stepOver();
                // Wait for our debug string to render in debug console
                await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                SmokeTestLogger.info("iOS Debug test: Searching for \"Test output from debuggee\" string in console");
                let found = await app.workbench.debug.waitForOutput(output => output.some(line => line.indexOf("Test output from debuggee") >= 0));
                assert.notStrictEqual(found, false, "\"Test output from debuggee\" string is missing in debug console");
                SmokeTestLogger.success("iOS Debug test: \"Test output from debuggee\" string is found");
                await app.workbench.debug.disconnectFromDebugger();
                SmokeTestLogger.info("iOS Debug test: Debugging is stopped");
            });
        }
    });
}
