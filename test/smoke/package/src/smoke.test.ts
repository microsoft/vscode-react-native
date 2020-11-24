// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { startDebugMacOSTests } from "./debugMacOS.test";
import { startDebugRNWTests } from "./debugWindows.test";
import { startDirectDebugTests } from "./directDebug.test";
import { startExpoTests } from "./expoDebug.test";
import AndroidEmulatorManager from "./helpers/androidEmulatorManager";
import { AppiumHelper } from "./helpers/appiumHelper";
import IosSimulatorManager from "./helpers/iosSimulatorManager";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/testConfigProcessor";
import { smokeTestFail } from "./helpers/utilities";
import { startLocalizationTests } from "./localization.test";
import { testApplicationSetupManager } from "./main";
import { startReactNativeTests } from "./nativeDebug.test";
import { startOtherTests } from "./otherTests.test";


export function startSmokeTests(args: TestRunArguments, setup: () => Promise<void>, cleanUp: () => Promise<void>): void {
    before(async function () {
        if (args.SkipSetup) {
            SmokeTestLogger.info("*** --skip-setup parameter is set, skipping clean up and apps installation");
        }
        else {
            try {
                this.timeout(SmokeTestsConstants.smokeTestSetupAwaitTimeout);
                await cleanUp();
                await setup();
            } catch (err) {
                await smokeTestFail(err);
            }
        }
    });

    describe("Extension smoke tests", () => {
        after(async function () {
            await AndroidEmulatorManager.terminateAllAndroidEmulators();
            if (process.platform === "darwin") {
                try {
                    await IosSimulatorManager.shutdownAllSimulators();
                } catch (e) {
                    SmokeTestLogger.error(`${e.toString()}`);
                }
            }
            AppiumHelper.terminateAppium();
        });

        startLocalizationTests(testApplicationSetupManager.getRnWorkspaceDirectory());
        const noSelectArgs = !args.RunAndroidTests && !args.RunIosTests && !args.RunBasicTests && !args.RunMacOSTests && !args.RunWindowsTests;
        if (noSelectArgs) {
            SmokeTestLogger.info("*** Android and iOS tests will be run");
            startReactNativeTests(testApplicationSetupManager.getRnWorkspaceDirectory());
            startDirectDebugTests(testApplicationSetupManager.getHermesWorkspaceDirectory());
            startExpoTests(testApplicationSetupManager.getExpoWorkspaceDirectory(), testApplicationSetupManager.getPureRnWorkspaceDirectory());
            startDebugMacOSTests(testApplicationSetupManager.getMacOSRnWorkspaceDirectory());
            startDebugRNWTests(testApplicationSetupManager.getWindowsRnWorkspaceDirectory());
            startOtherTests(testApplicationSetupManager.getRnWorkspaceDirectory());
        } else {
            startReactNativeTests(testApplicationSetupManager.getRnWorkspaceDirectory(), args);
            if (!args.RunBasicTests) {
                startDirectDebugTests(testApplicationSetupManager.getHermesWorkspaceDirectory(), args);
                startExpoTests(testApplicationSetupManager.getExpoWorkspaceDirectory(), testApplicationSetupManager.getPureRnWorkspaceDirectory(), args);
                startDebugMacOSTests(testApplicationSetupManager.getMacOSRnWorkspaceDirectory(), args);
                startDebugRNWTests(testApplicationSetupManager.getWindowsRnWorkspaceDirectory(), args);
                startOtherTests(testApplicationSetupManager.getRnWorkspaceDirectory());
            }
        }
    });
}
