// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { ElementHelper } from "./helper/elementHelper";
import { Constant } from "./helper/constants";
import { BaseSmokeTest } from "./helper/baseSmokeTest";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { TimeoutConstants } from "./helper/timeoutConstants";

export function startExtensionActivationTests(): void {
    describe("ExtensionActivationTest", () => {
        afterEach(BaseSmokeTest.dispose);

        it("Verify extension is activated", async () => {
            let isActivited = false;
            await BaseSmokeTest.initApp();

            try {
                await ElementHelper.WaitElementSelectorVisible(
                    `[id="${Constant.previewExtensionId}"]`,
                    TimeoutConstants.ACTIVATION_TIMEOUT,
                );
                SmokeTestLogger.info("React-native preview extension is activated");
                isActivited = true;
            } catch {
                try {
                    await ElementHelper.WaitElementSelectorVisible(
                        `[id="${Constant.prodExtensionId}"]`,
                        TimeoutConstants.ACTIVATION_TIMEOUT,
                    );
                    SmokeTestLogger.info("React-native prod extension is activated");
                    isActivited = true;
                } catch {
                    isActivited = false;
                }
            }
            assert.ok(isActivited, "Extension is not activated. Skip other test cases...");
        });
    });
}
