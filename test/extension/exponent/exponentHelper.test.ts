// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ExponentHelper } from "../../../src/extension/exponent/exponentHelper";
import * as path from "path";
import * as assert from "assert";
import * as sinon from "sinon";
import * as glob from "glob";
import { FileSystem } from "../../../src/common/node/fileSystem";

suite("exponentHelper", function () {
    const RESOURCES_ROOT = path.resolve(__dirname, "../../resources/exponentHelper");

    suite("extensionContext", () => {
        suite("isExpoManagedApp", () => {
            async function checkIsExpoManagedApp(
                expected: boolean,
                packageJson: any,
                globSyncStubFunc?: (pattern: string, options?: any) => string[],
            ) {
                let globSyncStub: Sinon.SinonStub | undefined = undefined;
                let fs = new FileSystem();
                sinon.stub(fs, "readFile", async () => JSON.stringify(packageJson));
                if (globSyncStubFunc) {
                    globSyncStub = sinon.stub(glob, "sync", globSyncStubFunc);
                }

                const expoHelper = new ExponentHelper(RESOURCES_ROOT, "", fs);
                const result = await expoHelper.isExpoManagedApp(false);
                assert.strictEqual(result, expected);

                if (globSyncStub) {
                    globSyncStub.restore();
                }
            }

            test("should return false if dependencies are empty", async () => {
                await checkIsExpoManagedApp(false, {});
            });
            test("should return false if (dev)dependencies.expo is missing", async () => {
                await checkIsExpoManagedApp(false, { dependencies: {} });
                await checkIsExpoManagedApp(false, { devDependencies: {} });
            });
            test("should return false if there are '.xcodeproj' files in 'ios/**' foldes", async () => {
                await checkIsExpoManagedApp(
                    false,
                    { dependencies: { expo: "37.0.1" } },
                    (pattern: string, options?: any) => {
                        return pattern === "ios/**/*.xcodeproj" ? ["ios/myProject.xcodeproj"] : [];
                    },
                );
            });
            test("should return false if there are '.gradle' files in 'android/**' foldes", async () => {
                await checkIsExpoManagedApp(
                    false,
                    { dependencies: { expo: "37.0.1" } },
                    (pattern: string, options?: any) => {
                        return pattern === "android/**/*.gradle" ? ["android/build.gradle"] : [];
                    },
                );
            });

            test("should return true if there are `expo` and 'expokit' packages in (dev)dependencies", async () => {
                await checkIsExpoManagedApp(true, {
                    dependencies: { expo: "37.0.1", expokit: "37.0.0" },
                });
                await checkIsExpoManagedApp(true, {
                    devDependencies: { expo: "37.0.1", expokit: "37.0.0" },
                });
            });

            test("should return true if (dev)dependencies.expo exists and there are no '.xcodeproj' and '.gradle' files", async () => {
                await checkIsExpoManagedApp(
                    true,
                    { dependencies: { expo: "37.0.1" } },
                    (pattern: string, options?: any) => [],
                );
                await checkIsExpoManagedApp(
                    true,
                    { devDependencies: { expo: "37.0.1" } },
                    (pattern: string, options?: any) => [],
                );
            });
        });
    });
});
