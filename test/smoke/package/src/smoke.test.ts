// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { startDirectDebugTests } from "./direct.test";
import { startExpoTests } from "./expo.test";
import AndroidEmulatorManager from "./helpers/AndroidEmulatorManager";
import { AppiumHelper } from "./helpers/appiumHelper";
import IosSimulatorManager from "./helpers/IosSimulatorManager";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/TestConfigProcessor";
import { smokeTestFail } from "./helpers/utilities";
import { startLocalizationTests } from "./localization.test";
import { testApplicationSetupManager } from "./main";
import { startReactNativeTests } from "./react-native.test";


export function startSmokeTests(args: TestRunArguments, setup: () => Promise<void>, cleanUp: () => Promise<void>): void {
    before(async function () {
        if (args.SkipSetup) {
            console.log("*** --skip-setup parameter is set, skipping clean up and apps installation");
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
                    console.error(e);
                }
            }
            AppiumHelper.terminateAppium();
        });
        startLocalizationTests(testApplicationSetupManager.getRnWorkspaceDirectory());
        const noSelectArgs = !args.RunAndroidTests && !args.RunIosTests && !args.RunBasicTests;
        if (noSelectArgs) {
            console.log("*** Android and iOS tests will be run");
            startReactNativeTests(testApplicationSetupManager.getRnWorkspaceDirectory());
            startExpoTests(testApplicationSetupManager.getExpoWorkspaceDirectory(), testApplicationSetupManager.getPureRnWorkspaceDirectory());
            startDirectDebugTests(testApplicationSetupManager.getHermesWorkspaceDirectory());
        } else {
            startReactNativeTests(testApplicationSetupManager.getRnWorkspaceDirectory(), args);
            if (!args.RunBasicTests) {
                startExpoTests(testApplicationSetupManager.getExpoWorkspaceDirectory(), testApplicationSetupManager.getPureRnWorkspaceDirectory(), args);
                startDirectDebugTests(testApplicationSetupManager.getHermesWorkspaceDirectory(), args);
            }
        }
    });
}