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


export function startSmokeTests(
    args: TestRunArguments,
    setup: (useCachedApplications: boolean) => Promise<void>,
    cleanUp: (saveCache: boolean) => Promise<void>
): void {
    before(async function () {
        if (args.UseCachedApplications) {
            SmokeTestLogger.info("*** --use-cache parameter is set, skipping reinstallation of test projects");
        }
        if (args.SkipSetup) {
            SmokeTestLogger.info("*** --skip-setup parameter is set, skipping clean up and apps installation");
        }
        else {
            try {
                this.timeout(SmokeTestsConstants.smokeTestSetupAwaitTimeout);
                await cleanUp(args.UseCachedApplications);
                await setup(args.UseCachedApplications);
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
            await AppiumHelper.terminateAppium();
        });

        startLocalizationTests(testApplicationSetupManager.getRnWorkspaceDirectory());

        SmokeTestLogger.info("*** Smoke tests will be run");
        startReactNativeTests(testApplicationSetupManager.getRnWorkspaceDirectory(), args);
        startDirectDebugTests(testApplicationSetupManager.getHermesWorkspaceDirectory(), args);
        startExpoTests(testApplicationSetupManager.getExpoWorkspaceDirectory(), testApplicationSetupManager.getPureRnWorkspaceDirectory(), args);
        startDebugMacOSTests(testApplicationSetupManager.getMacOSRnWorkspaceDirectory(), args);
        startDebugRNWTests(testApplicationSetupManager.getWindowsRnWorkspaceDirectory(), args);
        startOtherTests(testApplicationSetupManager.getRnWorkspaceDirectory(), args);

    });
}
