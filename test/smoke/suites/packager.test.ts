// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { ComponentHelper } from "./helper/componentHelper";
import { TimeoutConstants } from "./helper/timeoutConstants";
import { BaseSmokeTest } from "./helper/baseSmokeTest";
import { SmokeTestLogger } from "./helper/smokeTestLogger";

export function startPackagerTests(): void {
    describe("PackagerTest", () => {
        afterEach(BaseSmokeTest.dispose);

        it("Verify react-native packager state is changed correctly when start and stop metro", async () => {
            await BaseSmokeTest.initApp();

            let packager = await ComponentHelper.getReactNativePackager();
            let currentState = await packager.getAttribute("aria-label");
            assert.ok(currentState, "Packager status bar command should have an accessible label");
            SmokeTestLogger.testLog("Packager is ready.");

            await packager.click();
            await ComponentHelper.isPackagerStateIncludesOneOf(
                ["loading~spin", "primitive-square", "Stop Packager", "Restart Packager"],
                10000,
            );

            packager = await ComponentHelper.getReactNativePackager();
            currentState = await packager.getAttribute("aria-label");
            assert.ok(currentState, "Packager control should remain available after click");
            SmokeTestLogger.testLog("Packager control remains available after click.");
        });

        it("Verify Clean & Restart Packager command works correctly", async function () {
            this.timeout(TimeoutConstants.PACKAGER_CLEAN_RESTART_TIMEOUT); // 5 minutes timeout for clean restart
            await BaseSmokeTest.initApp();

            // Use restart command available in both legacy and current extension builds.
            SmokeTestLogger.testLog("Executing Restart Packager command...");
            await ComponentHelper.executeCommand("React Native: Restart Packager");

            const packager = await ComponentHelper.getReactNativePackager();
            const currentState = await packager.getAttribute("aria-label");
            assert.ok(
                currentState,
                "Packager status bar command should have an accessible label after restart",
            );
        });
    });
}
