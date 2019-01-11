// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ExponentHelper } from "../../../src/extension/exponent/exponentHelper";
import * as path from "path";
import * as assert from "assert";
import * as sinon from "sinon";
import * as Q from "q";
import { FileSystem } from "../../../src/common/node/fileSystem";

suite("exponentHelper", function() {
    const RESOURCES_ROOT = path.resolve(__dirname, "../../resources/exponentHelper");

    async function checkIsExpoApp(packageJson: any, expected: boolean) {
        let fs = new FileSystem();
        sinon.stub(fs, "readFile", () => Q.resolve(JSON.stringify(packageJson)));
        const expoHelper = new ExponentHelper(RESOURCES_ROOT, "", fs);
        const result = await expoHelper.isExpoApp(false);
        assert.equal(result, expected);
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
            test("should return true if (dev)dependencies.expo is appeared", async () => {
                await checkIsExpoApp({dependencies: {expo: {}}}, true);
                await checkIsExpoApp({devDependencies: {expo: {}}}, true);
            });
        });
    });
});