// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { Application } from "../../automation";
import { AppiumClient, AppiumHelper} from "./helpers/appiumHelper";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/TestConfigProcessor";
import { sleep } from "./helpers/utilities";
import { androidEmulatorManager, vscodeManager } from "./main";

const HERMES_APP_PACKAGE_NAME = `com.${SmokeTestsConstants.HermesAppName.toLocaleLowerCase()}`;
const HERMES_APP_ACTIVITY_NAME = `com.${SmokeTestsConstants.HermesAppName.toLocaleLowerCase()}.MainActivity`;
const RNHermesDebugConfigName = "Debug Android (Hermes) - Experimental";
const RNHermesAttachConfigName = "Attach to Hermes application - Experimental";

const RNHermesSetBreakpointOnLine = 11;
// Time for Android Debug Test before it reaches timeout
const debugAndroidTestTime = SmokeTestsConstants.androidTestTimeout;

export function startDirectDebugTests(workspace: string, testParameters?: TestRunArguments): void {

    describe("Direct debugging", () => {
        let app: Application;
        let client: AppiumClient;

        async function disposeAll() {
            if (app) {
                await app.stop();
            }
            if (client) {
                client.closeApp();
                client.deleteSession();
            }
        }

        afterEach(disposeAll);

        if (!testParameters || !testParameters.RunBasicTests) {
            it("Hermes RN app Debug test", async function () {
                try {
                    this.timeout(debugAndroidTestTime);
                    androidEmulatorManager.uninstallTestAppFromEmulator(HERMES_APP_PACKAGE_NAME);
                    app = await vscodeManager.runVSCode(workspace);
                    await app.workbench.quickaccess.openFile("AppTestButton.js");
                    await app.workbench.editors.scrollTop();
                    console.log("Android Debug Hermes test: AppTestButton.js file is opened");
                    await app.workbench.debug.setBreakpointOnLine(RNHermesSetBreakpointOnLine);
                    console.log(`Android Debug Hermes test: Breakpoint is set on line ${RNHermesSetBreakpointOnLine}`);
                    console.log(`Android Debug Hermes test: Chosen debug configuration: ${RNHermesDebugConfigName}`);
                    console.log("Android Debug Hermes test: Starting debugging");
                    await app.workbench.quickaccess.runDebugScenario(RNHermesDebugConfigName);
                    const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(HERMES_APP_PACKAGE_NAME, HERMES_APP_ACTIVITY_NAME, androidEmulatorManager.getEmulatorName());
                    await androidEmulatorManager.waitUntilAppIsInstalled(HERMES_APP_PACKAGE_NAME);
                    let client = await AppiumHelper.webdriverAttach(opts);
                    await app.workbench.debug.waitForDebuggingToStart();
                    console.log("Android Debug Hermes test: Debugging started");
                    console.log("Android Debug Hermes test: Checking for Hermes mark");
                    let isHermesWorking = await AppiumHelper.isHermesWorking(client);
                    assert.strictEqual(isHermesWorking, true);
                    console.log("Android Debug Hermes test: Reattaching to Hermes app");
                    await app.workbench.debug.disconnectFromDebugger();
                    await app.workbench.quickaccess.runDebugScenario(RNHermesAttachConfigName);
                    console.log("Android Debug Hermes test: Reattached successfully");
                    await sleep(7000);
                    console.log("Android Debug Hermes test: Click Test Button");
                    await AppiumHelper.clickTestButtonHermes(client);
                    await app.workbench.debug.waitForStackFrame(sf => sf.name === "AppTestButton.js" && sf.lineNumber === RNHermesSetBreakpointOnLine, `looking for AppTestButton.js and line ${RNHermesSetBreakpointOnLine}`);
                    console.log("Android Debug Hermes test: Stack frame found");
                    await app.workbench.debug.continue();
                    // await for our debug string renders in debug console
                    await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                    let found = vscodeManager.findStringInLogs("Test output from Hermes debuggee", SmokeTestsConstants.ReactNativeLogFileName);
                    assert.notStrictEqual(found, false, "\"Test output from Hermes debuggee\" string is missing in output file");
                    await app.workbench.debug.disconnectFromDebugger();
                    console.log("Android Debug Hermes test: Debugging is stopped");
                } catch (e) {
                    console.log("Android Debug Hermes test failed: " + e);
                    return this.skip();
                }
            });
        }
    });
}
