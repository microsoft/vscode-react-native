// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import { ReactNativeProjectHelper } from "../../../src/common/reactNativeProjectHelper";
import { FileSystem } from "../../../src/common/node/fileSystem";

suite("expoWeb", function () {
    test("should add expo web metro bundler in app.json if it's not existing", async () => {
        const projectPath = path.join(__dirname, "..", "..", "resources", "sampleExpoProject");
        const launchArgs = {
            cwd: projectPath,
        };
        const appJsonPath = path.join(launchArgs.cwd, "app.json");
        const fs = new FileSystem();
        const appJson = await fs.readFile(appJsonPath);
        const jsonString = JSON.stringify(appJson);
        assert.strictEqual(jsonString.includes("bundler") && jsonString.includes("metro"), false);

        await ReactNativeProjectHelper.UpdateMertoBundlerForExpoWeb(launchArgs);
        const newAppJson = await fs.readFile(appJsonPath);
        const newJsonString = JSON.stringify(newAppJson);
        assert.strictEqual(
            newJsonString.includes("bundler") && newJsonString.includes("metro"),
            true,
        );
    });
});
