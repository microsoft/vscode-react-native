// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// The module "assert" provides assertion methods from node
import * as assert from "assert";
import * as path from "path";

import { ReactDirManager } from "../../src/extension/reactDirManager";

suite("reactDirManager.ts", () => {
    suite("extensionContext", function () {
        suite("ReactDirPath", function () {
            test("Should end with the correct path to the react folder", () => {
                let reactPath = new ReactDirManager("").reactDirPath;

                assert.strictEqual(".react", path.basename(reactPath));
                reactPath = path.dirname(reactPath);
                assert.strictEqual(".vscode", path.basename(reactPath));
            });
        });
    });
});
