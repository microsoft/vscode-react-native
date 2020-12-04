// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CommandPaletteHandler } from "../../src/extension/commandPaletteHandler";
import * as assert from "assert";

suite("elementInspector", function () {
    suite("extensionContext", function () {
        test("element inspector should run and closed without errors", function (done: Mocha.Done) {
            CommandPaletteHandler.runElementInspector();
            assert.notStrictEqual(CommandPaletteHandler.elementInspector, null);

            if (CommandPaletteHandler.elementInspector) {
                CommandPaletteHandler.elementInspector.once("exit", () => {
                    assert.strictEqual(CommandPaletteHandler.elementInspector, null);
                    done();
                });
            } else {
                assert.ifError("element inspector didn't launch properly");
            }
            CommandPaletteHandler.stopElementInspector();
        });

        test("element inspector should not allow multiple windows to run", function (done: Mocha.Done) {
            CommandPaletteHandler.runElementInspector();
            if (CommandPaletteHandler.elementInspector) {
                let PID = CommandPaletteHandler.elementInspector.pid;
                CommandPaletteHandler.runElementInspector();
                assert.strictEqual(CommandPaletteHandler.elementInspector.pid, PID);
                CommandPaletteHandler.stopElementInspector();
                done();
            } else {
                assert.ifError("element inspector didn't launch properly");
            }
        });
    });
});
