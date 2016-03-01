// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {SimulatorPlist} from "../../../common/ios/simulatorPlist";

import * as path from "path";
import * as Q from "q";
import * as sinon from "sinon";

suite("plistBuddy", function() {
    suite("commonContext", function() {
        test("Should correctly find the NSUserDefaults plist file for the simulator", function() {
            const projectRoot = path.join("project", "root");

            const bundleId = "com.contoso.app";

            const findSimulatorHomeCommand = "xcrun simctl getenv booted HOME";
            // The emulator's home folder is /simulator/home
            const findSimulatorHomeResult = path.join("/", "simulator", "home");

            const prefix = path.join("Containers", "Data", "Application");
            const suffix = path.join("Library", "Preferences");

            // The emulator has 3 apps, app1 app2 and app3
            const appIds = ["app1", "app2", "app3"];

            // readdir finds appIds
            const mockReadDir = sinon.stub();
            mockReadDir.withArgs(path.join(findSimulatorHomeResult, prefix)).returns(Q.resolve(appIds));
            mockReadDir.throws();

            // Only app2 has a plist file with thus bundle name
            const existingPlistFile = path.join(findSimulatorHomeResult, prefix, "app2", suffix, `${bundleId}.plist`);

            // existsSync only finds existingPlistFile to exist
            const mockExistsSync = sinon.stub();
            mockExistsSync.withArgs(existingPlistFile).returns(true);
            mockExistsSync.returns(false);

            const mockFS: any = {
                existsSync: mockExistsSync,
                readDir: mockReadDir
            };

            // getBundleId returns bundleId
            const bundleIdStub = sinon.stub();
            bundleIdStub.withArgs(projectRoot).returns(Q.resolve(bundleId));
            bundleIdStub.returns(Q.reject("Incorrect project root"));

            const mockPlistBuddy: any = {
                getBundleId: bundleIdStub
            };

            // exec-ing the correct command returns the simulator home
            const execStub = sinon.stub();
            execStub.withArgs(findSimulatorHomeCommand).returns({ outcome: Q.resolve(findSimulatorHomeResult) });
            execStub.throws();
            const mockChildProcess: any = {
                exec: execStub
            };

            const simulatorPlist = new SimulatorPlist(projectRoot, {
                nodeFileSystem: mockFS,
                plistBuddy: mockPlistBuddy,
                nodeChildProcess: mockChildProcess
            });

            return simulatorPlist.findPlistFile().then((plistFile) => {
                if (plistFile !== existingPlistFile) {
                    throw new Error("Returned incorrect value");
                }
            });
        });
    });
});