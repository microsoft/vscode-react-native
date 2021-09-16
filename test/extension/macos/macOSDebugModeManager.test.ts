// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { MacOSDebugModeManager } from "../../../src/extension/macos/macOSDebugModeManager";

import * as assert from "assert";
import * as path from "path";
import * as sinon from "sinon";
import { homedir } from "os";

suite("macOSDebugModeManager", function () {
    suite("extensionContext", function () {
        test("findPlistFile should correctly find the NSUserDefaults plist file for an app", async function () {
            const projectRoot = path.join("/", "tmp");
            const macosProjectRoot = path.join(projectRoot, "myProject");
            const bundleId = "org.reactjs.native.rn-macos";

            const existingPlistFilePath = path.join(
                homedir(),
                "Library",
                "Preferences",
                `${bundleId}.plist`,
            );

            // "exists" only finds existingPlistFile file
            const mockExists = sinon.stub();
            mockExists.withArgs(existingPlistFilePath).returns(Promise.resolve(true));
            mockExists.returns(Promise.resolve(false));

            const mockFS: any = {
                exists: mockExists,
            };

            // getBundleId returns bundleId
            const bundleIdStub = sinon.stub();
            bundleIdStub.withArgs(macosProjectRoot).returns(Promise.resolve(bundleId));
            bundleIdStub.returns(Promise.reject("Incorrect project root"));

            const mockPlistBuddy: any = {
                getBundleId: bundleIdStub,
            };

            let macOSDebugModeManager = new MacOSDebugModeManager(
                macosProjectRoot,
                projectRoot,
                undefined,
                {
                    nodeFileSystem: mockFS,
                    plistBuddy: mockPlistBuddy,
                },
            );

            const plistFile = await (macOSDebugModeManager as any).findPlistFile();
            assert(plistFile === existingPlistFilePath, "Returned incorrect value");
        });
    });
});
