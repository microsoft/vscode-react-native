// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    RunElementInspector,
    StopElementInspector,
} from "../../src/extension/commands/elementInspector";

suite("elementInspector", function () {
    suite("extensionContext", function () {
        const runElementInspector = new RunElementInspector();
        const stopElementInspector = new StopElementInspector();

        test("element inspector should run and close without errors", async function () {
            await runElementInspector.baseFn();
            await stopElementInspector.baseFn();
        });

        test("element inspector should not allow multiple windows to run", async function () {
            await runElementInspector.baseFn();
            await runElementInspector.baseFn();
            await stopElementInspector.baseFn();
        });
    });
});
