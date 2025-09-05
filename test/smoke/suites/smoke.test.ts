// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { startCommandPaletteTests } from "./commands.test";
import { SmokeTestLogger } from "./helper/smokeTestLogger";
import { smokeTestFail } from "./helper/utilities";

export function startSmokeTests(setup: () => Promise<void>, cleanUp: () => Promise<void>): void {
    before(async function () {
        try {
            await cleanUp();
            await setup();
        } catch (err) {
            await smokeTestFail(err);
        }
    });

    after(async function () {
        SmokeTestLogger.info("Test execution completed.");
    });

    describe("Extension smoke tests", () => {
        startCommandPaletteTests();
    });
}
