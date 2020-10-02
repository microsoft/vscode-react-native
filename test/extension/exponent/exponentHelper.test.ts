// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ExponentHelper } from "../../../src/extension/exponent/exponentHelper";
import * as path from "path";
import * as assert from "assert";
import * as sinon from "sinon";
import { FileSystem } from "../../../src/common/node/fileSystem";

suite("exponentHelper", function() {
    const RESOURCES_ROOT = path.resolve(__dirname, "../../resources/exponentHelper");

    async function checkIsExpoApp(packageJson: any, expected: boolean) {
        let fs = new FileSystem();
        sinon.stub(fs, "readFile", () => Promise.resolve(JSON.stringify(packageJson)));
        const expoHelper = new ExponentHelper(RESOURCES_ROOT, "", fs);
        const result = await expoHelper.isExpoApp(false);
        assert.strictEqual(result, expected);
    }

    suite("extensionContext", () => {
        suite("isExp", () => {
            test("should return false if dependencies are empty", async () => {
                await checkIsExpoApp({}, false);
            });
            test("should return false if (dev)dependencies.expo is missing", async () => {
                await checkIsExpoApp({dependencies: {}}, false);
                await checkIsExpoApp({devDependencies: {}}, false);
            });
            test("should return false if dependencies.react-native is missing or incorrect", async () => {
                await checkIsExpoApp({dependencies: {}}, false);
                await checkIsExpoApp({dependencies: {"react-native": ""}}, false);
                await checkIsExpoApp({dependencies: {"react-native": "0.58.8"}}, false);
            });
            test("should return true if (dev)dependencies.expo exists and dependencies.react-native is correct", async () => {
                await checkIsExpoApp({dependencies: {expo: "33.0.1", "react-native": "https://github.com/expo/react-native/archive/sdk-31.0.0.tar.gz"}}, true);
                await checkIsExpoApp({devDependencies: {expo: "33.0.1"}, dependencies: {"react-native": "https://github.com/expo/react-native/archive/sdk-31.0.0.tar.gz"}}, true);
            });
        });
    });
});