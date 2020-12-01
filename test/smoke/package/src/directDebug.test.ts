// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { Application } from "../../automation";
import { AppiumClient, AppiumHelper } from "./helpers/appiumHelper";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import { sleep } from "./helpers/utilities";
import { androidEmulatorManager, vscodeManager } from "./main";

const HERMES_APP_PACKAGE_NAME = `com.${SmokeTestsConstants.HermesAppName.toLocaleLowerCase()}`;
const HERMES_APP_ACTIVITY_NAME = `com.${SmokeTestsConstants.HermesAppName.toLocaleLowerCase()}.MainActivity`;
const RNHermesDebugConfigName = "Debug Android (Hermes) - Experimental";
const RNHermesAttachConfigName = "Attach to Hermes application - Experimental";

const RNHermesSetBreakpointOnLine = 11;
// Time for Android Debug Test before it reaches timeout
const debugAndroidTestTime = SmokeTestsConstants.hermesTestTimeout;

export function startDirectDebugTests(workspace: string, testParameters: TestRunArguments): void {

    describe("Direct debugging", () => {
        let app: Application | null;
        let client: AppiumClient | null;

        async function disposeAll() {
            SmokeTestLogger.info("Dispose all ...");
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await stopPackager();
                await app.stop();
                app = null;
            }
            if (client) {
                await client.closeApp();
                await client.deleteSession();
                client = null;
            }
        }

        async function stopPackager() {
            await app.workbench.quickaccess.runCommand(SmokeTestsConstants.stopPackagerCommand);
            await sleep(3000);
        }

        afterEach(disposeAll);

        if (testParameters.RunAndroidTests) {
            it("Hermes RN app Debug test", async function () {
                try {
                    this.timeout(debugAndroidTestTime);
                    app = await vscodeManager.runVSCode(workspace, "Hermes RN app Debug test");
                    await app.workbench.quickaccess.openFile("AppTestButton.js");
                    await app.workbench.editors.scrollTop();
                    SmokeTestLogger.info("Android Debug Hermes test: AppTestButton.js file is opened");
                    await app.workbench.debug.setBreakpointOnLine(RNHermesSetBreakpointOnLine);
                    SmokeTestLogger.info(`Android Debug Hermes test: Breakpoint is set on line ${RNHermesSetBreakpointOnLine}`);
                    SmokeTestLogger.info(`Android Debug Hermes test: Chosen debug configuration: ${RNHermesDebugConfigName}`);
                    SmokeTestLogger.info("Android Debug Hermes test: Starting debugging");
                    await app.workbench.quickaccess.runDebugScenario(RNHermesDebugConfigName);
                    const opts = AppiumHelper.prepareAttachOptsForAndroidActivity(HERMES_APP_PACKAGE_NAME, HERMES_APP_ACTIVITY_NAME, androidEmulatorManager.getEmulatorId());
                    await androidEmulatorManager.waitUntilAppIsInstalled(HERMES_APP_PACKAGE_NAME);
                    client = await AppiumHelper.webdriverAttach(opts);
                    await app.workbench.debug.waitForDebuggingToStart();
                    SmokeTestLogger.info("Android Debug Hermes test: Debugging started");
                    SmokeTestLogger.info("Android Debug Hermes test: Checking for Hermes mark");
                    let isHermesWorking = await AppiumHelper.isHermesWorking(client);
                    assert.strictEqual(isHermesWorking, true);
                    SmokeTestLogger.info("Android Debug Hermes test: Reattaching to Hermes app");
                    await app.workbench.debug.disconnectFromDebugger();
                    await app.workbench.quickaccess.runDebugScenario(RNHermesAttachConfigName);
                    SmokeTestLogger.info("Android Debug Hermes test: Reattached successfully");
                    await sleep(7000);
                    SmokeTestLogger.info("Android Debug Hermes test: Click Test Button");
                    await AppiumHelper.clickTestButtonHermes(client);
                    await app.workbench.debug.waitForStackFrame(sf => sf.name === "AppTestButton.js" && sf.lineNumber === RNHermesSetBreakpointOnLine, `looking for AppTestButton.js and line ${RNHermesSetBreakpointOnLine}`);
                    SmokeTestLogger.info("Android Debug Hermes test: Stack frame found");
                    await app.workbench.debug.continue();
                    // await for our debug string renders in debug console
                    await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                    let found = vscodeManager.findStringInLogs("Test output from Hermes debuggee", SmokeTestsConstants.ReactNativeLogFileName);
                    assert.notStrictEqual(found, false, "\"Test output from Hermes debuggee\" string is missing in output file");
                    if (found) {
                        SmokeTestLogger.success("Android Debug test: \"Test output from Hermes debuggee\" string is found");
                    }
                    await app.workbench.debug.disconnectFromDebugger();
                    SmokeTestLogger.info("Android Debug Hermes test: Debugging is stopped");
                } catch (e) {
                    SmokeTestLogger.error(`Android Debug Hermes test failed: ${e.toString()}`);
                    await stopPackager();
                    return this.skip();
                }
            });
        }
    });
}
