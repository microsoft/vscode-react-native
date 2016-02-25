// The module "assert" provides assertion methods from node
import * as assert from "assert";
import * as path from "path";

import * as reactDirManager from "../extension/reactDirManager";

suite("reactDirManager.ts", () => {
    suite("ReactDirPath", function () {
        test("Should end with the correct path to the react folder", () => {
            let reactPath = reactDirManager.ReactDirManager.ReactDirPath;

            assert.strictEqual(".react", path.basename(reactPath));
            reactPath = path.dirname(reactPath);
            assert.strictEqual(".vscode", path.basename(reactPath));
        });
    });
});