// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { startAndroidTests } from "./debugAndroid.test";
import { startIosTest } from "./debugIos.test";
import AndroidEmulatorManager from "./helpers/AndroidEmulatorManager";
import { AppiumHelper } from "./helpers/appiumHelper";
import IosSimulatorManager from "./helpers/IosSimulatorManager";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestRunArguments } from "./helpers/TestConfigProcessor";
import { smokeTestFail } from "./helpers/utilities";
import { startLocalizationTests } from "./localization.test";


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
        startLocalizationTests();
        if (process.platform === "darwin") {
            const noSelectArgs = !args.RunAndroidTests && !args.RunIosTests && !args.RunBasicTests;
            if (noSelectArgs) {
                console.log("*** Android and iOS tests will be run");
                startAndroidTests();
                startIosTest();
            } else if (args.RunBasicTests) {
                console.log("*** --basic-only parameter is set, basic Android and iOS tests will be run");
                startAndroidTests(args);
                startIosTest(args);
            } else if (args.RunAndroidTests) {
                console.log("*** --android parameter is set, Android tests will be run");
                startAndroidTests();
            } else if (args.RunIosTests) {
                console.log("*** --ios parameter is set, iOS tests will be run");
                startIosTest();
            }
        } else {
            if (args.RunBasicTests) {
                console.log("*** --basic-only parameter is set, basic Android tests will be run");
                startAndroidTests(args);
            } else {
                startAndroidTests();
            }

        }
    });
}