// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SimulatorPlist } from "../../../src/extension/ios/simulatorPlist";

import * as assert from "assert";
import * as path from "path";
import * as sinon from "sinon";

suite("plistBuddy", function () {
    suite("extensionContext", function () {
        test("findPlistFile should correctly find the NSUserDefaults plist file for the simulator", async function () {
            const projectRoot = path.join("/", "tmp");
            const iosProjectRoot = path.join(projectRoot, "myProject");

            const bundleId = "com.contoso.app";

            const findSimulatorHomeCommand = "xcrun simctl getenv booted HOME";
            // The emulator's home folder is /simulator/home
            const findSimulatorHomeResult = path.join(
                "/",
                "Users",
                "theUser",
                "Library",
                "Developer",
                "CoreSimulator",
                "Devices",
                "FA511653-BA51-479F-A218-1DBD1910D5E5/data",
            );

            const prefix = path.join("Containers", "Data", "Application");
            const suffix = path.join("Library", "Preferences");

            // The emulator has 3 apps
            const appIds = [
                "17F3AED1-5B1D-4F97-B419-D1F079D9DE2D",
                "957660FD-3417-474E-B2AC-8AA0A05AD9A0",
                "18319C8B-0583-4967-8023-15859A0BF0F3",
            ];

            // readdir finds appIds
            const mockReadDir = sinon.stub();
            mockReadDir
                .withArgs(path.join(findSimulatorHomeResult, prefix))
                .returns(Promise.resolve(appIds));
            mockReadDir.throws();

            // Only the second app has a plist file with thus bundle name
            const existingPlistFile = path.join(
                findSimulatorHomeResult,
                prefix,
                "957660FD-3417-474E-B2AC-8AA0A05AD9A0",
                suffix,
                `${bundleId}.plist`,
            );

            // existsSync only finds existingPlistFile to exist
            const mockExistsSync = sinon.stub();
            mockExistsSync.withArgs(existingPlistFile).returns(true);
            mockExistsSync.returns(false);

            const mockFS: any = {
                existsSync: mockExistsSync,
                readDir: mockReadDir,
            };

            // getBundleId returns bundleId
            const bundleIdStub = sinon.stub();
            bundleIdStub.withArgs(iosProjectRoot).returns(Promise.resolve(bundleId));
            bundleIdStub.returns(Promise.reject("Incorrect project root"));

            const mockPlistBuddy: any = {
                getBundleId: bundleIdStub,
            };

            // exec-ing the correct command returns the simulator home
            const execStub = sinon.stub();
            execStub
                .withArgs(findSimulatorHomeCommand)
                .returns(Promise.resolve({ outcome: Promise.resolve(findSimulatorHomeResult) }));
            execStub.throws();
            const mockChildProcess: any = {
                exec: execStub,
            };

            const simulatorPlist = new SimulatorPlist(iosProjectRoot, projectRoot, undefined, {
                nodeFileSystem: mockFS,
                plistBuddy: mockPlistBuddy,
                nodeChildProcess: mockChildProcess,
            });

            const plistFile = await simulatorPlist.findPlistFile();
            assert(plistFile === existingPlistFile, "Returned incorrect value");
        });
    });
});
