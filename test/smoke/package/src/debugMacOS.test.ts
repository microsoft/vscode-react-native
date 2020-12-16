// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as cp from "child_process";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { vscodeManager } from "./main";
import { sleep } from "./helpers/utilities";
import { Application } from "../../automation";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { TestRunArguments } from "./helpers/testConfigProcessor";

const RNmacOSDebugConfigName = "Debug macOS";

const RNmacOSsetBreakpointOnLine = 1;

// Time for macOS Debug Test before it reaches timeout
const debugMacOSTestTime = SmokeTestsConstants.macOSTestTimeout;

export function startDebugMacOSTests(workspace: string, testParameters: TestRunArguments): void {
    describe("Debugging macOS", () => {
        let app: Application;

        async function disposeAll() {
            SmokeTestLogger.info("Dispose all ...");
            if (app) {
                SmokeTestLogger.info("Stopping React Native packager ...");
                await app.workbench.quickaccess.runCommand(SmokeTestsConstants.stopPackagerCommand);
                await sleep(3000);
                await app.stop();
            }
            terminateMacOSapp(SmokeTestsConstants.RNmacOSAppName);
        }

        afterEach(disposeAll);

        function terminateMacOSapp(appName: string) {
            SmokeTestLogger.info(`*** Searching for ${appName} macOS application process`);
            const searchForMacOSappProcessCommand = `ps -ax | grep ${appName}`;
            const searchResults = cp.execSync(searchForMacOSappProcessCommand).toString();
            // An example of the output from the command above:
            // 40943 ??         4:13.97 node /Users/user/Documents/rn_for_mac_proj/node_modules/.bin/react-native start --port 8081
            // 40959 ??         0:10.36 /Users/user/.nvm/versions/node/v10.19.0/bin/node /Users/user/Documents/rn_for_mac_proj/node_modules/metro/node_modules/jest-worker/build/workers/processChild.js
            // 41004 ??         0:21.34 /Users/user/Library/Developer/Xcode/DerivedData/rn_for_mac_proj-ghuavabiztosiqfqkrityjoxqfmv/Build/Products/Debug/rn_for_mac_proj.app/Contents/MacOS/rn_for_mac_proj
            // 75514 ttys007    0:00.00 grep --color=auto --exclude-dir=.bzr --exclude-dir=CVS --exclude-dir=.git --exclude-dir=.hg --exclude-dir=.svn rn_for_mac_proj
            SmokeTestLogger.info(
                `*** Searching for ${appName} macOS application process: results ${JSON.stringify(
                    searchResults,
                )}`,
            );

            if (searchResults) {
                const processIdRgx = /(^\d*)\s\?\?/g;
                //  We are looking for a process whose path contains the "appName.app" part
                const processData = searchResults
                    .split("\n")
                    .find(str => str.includes(`${appName}.app`));

                if (processData) {
                    const match = processIdRgx.exec(processData);
                    if (match && match[1]) {
                        SmokeTestLogger.info(
                            `*** Terminating ${appName} macOS application process with PID ${match[1]}`,
                        );
                        const terminateMacOSappProcessCommand = `kill ${match[1]}`;
                        cp.execSync(terminateMacOSappProcessCommand);
                    }
                }
            }
        }

        if (process.platform === "darwin" && testParameters.RunMacOSTests) {
            it("RN macOS app Debug test", async function () {
                this.timeout(debugMacOSTestTime);
                app = await vscodeManager.runVSCode(workspace, "RN macOS app Debug test");
                await app.workbench.quickaccess.openFile("App.js");
                await app.workbench.editors.scrollTop();
                SmokeTestLogger.info("macOS Debug test: App.js file is opened");
                await app.workbench.debug.setBreakpointOnLine(RNmacOSsetBreakpointOnLine);
                SmokeTestLogger.info(
                    `macOS Debug test: Breakpoint is set on line ${RNmacOSsetBreakpointOnLine}`,
                );
                SmokeTestLogger.info(
                    `macOS Debug test: Chosen debug configuration: ${RNmacOSDebugConfigName}`,
                );
                SmokeTestLogger.info("macOS Debug test: Starting debugging");
                await app.workbench.quickaccess.runDebugScenario(RNmacOSDebugConfigName);
                await app.workbench.debug.waitForDebuggingToStart();
                SmokeTestLogger.info("macOS Debug test: Debugging started");
                await app.workbench.debug.waitForStackFrame(
                    sf => sf.name === "App.js" && sf.lineNumber === RNmacOSsetBreakpointOnLine,
                    `looking for App.js and line ${RNmacOSsetBreakpointOnLine}`,
                );
                SmokeTestLogger.info("macOS Debug test: Stack frame found");
                await app.workbench.debug.stepOver();
                // Wait for our debug string to render in debug console
                await sleep(SmokeTestsConstants.debugConsoleSearchTimeout);
                SmokeTestLogger.info(
                    'macOS Debug test: Searching for "Test output from debuggee" string in console',
                );
                let found = await app.workbench.debug.waitForOutput(output =>
                    output.some(line => line.indexOf("Test output from debuggee") >= 0),
                );
                assert.notStrictEqual(
                    found,
                    false,
                    '"Test output from debuggee" string is missing in debug console',
                );
                SmokeTestLogger.success(
                    'macOS Debug test: "Test output from debuggee" string is found',
                );
                await app.workbench.debug.disconnectFromDebugger();
                SmokeTestLogger.info("macOS Debug test: Debugging is stopped");
            });
        }
    });
}
