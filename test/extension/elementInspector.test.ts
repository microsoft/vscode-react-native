// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CommandPaletteHandler } from "../../src/extension/commandPaletteHandler";
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";


suite("elementInspector", function() {
    suite("extensionContext", function () {

        test("element inspector should run and closed without errors", function(done: MochaDone) {
            const devToolsPath = path.resolve(__dirname, "..", "..", "node_modules", "react-devtools", "app.js");
            assert.equal(fs.existsSync(devToolsPath), true);
            CommandPaletteHandler.runElementInspector();
            assert.notEqual(CommandPaletteHandler.elementInspector, null);

            if (CommandPaletteHandler.elementInspector) {
                CommandPaletteHandler.elementInspector.once("exit", () => {
                    assert.equal(CommandPaletteHandler.elementInspector, null);
                    done();
                });
            } else {
                assert.ifError("element inspector didn't launch properly");
            }
            CommandPaletteHandler.stopElementInspector();
        });

        test("element inspector should not allow multiple windows to run", function(done: MochaDone) {
            CommandPaletteHandler.runElementInspector();
            if (CommandPaletteHandler.elementInspector) {
                let PID = CommandPaletteHandler.elementInspector.pid;
                CommandPaletteHandler.runElementInspector();
                assert.equal(CommandPaletteHandler.elementInspector.pid, PID);
                CommandPaletteHandler.stopElementInspector();
                done();
            } else {
                assert.ifError("element inspector didn't launch properly");
            }
        });
    });

});