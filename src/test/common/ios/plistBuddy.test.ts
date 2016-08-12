// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {PlistBuddy} from "../../../common/ios/plistBuddy";

import * as assert from "assert";
import * as path from "path";
import * as Q from "q";
import * as sinon from "sinon";

suite("plistBuddy", function() {
    suite("commonContext", function() {
        test("setPlistProperty should attempt to modify, then add, plist properties", function() {
            const plistFileName = "testFile.plist";
            const plistProperty = ":RCTDevMenu:ExecutorClass";
            const plistValue = "RCTWebSocketExecutor";

            const setCallArgs = `/usr/libexec/PlistBuddy -c 'Set ${plistProperty} ${plistValue}' '${plistFileName}'`;
            const addCallArgs = `/usr/libexec/PlistBuddy -c 'Add ${plistProperty} string ${plistValue}' '${plistFileName}'`;

            const mockedExecFunc = sinon.stub();
            mockedExecFunc.withArgs(setCallArgs).returns({ outcome: Q.reject(new Error("Setting does not exist")) });
            mockedExecFunc.withArgs(addCallArgs).returns({ outcome: Q.resolve("stdout") });
            mockedExecFunc.throws();

            const mockChildProcess: any = {
                exec: mockedExecFunc,
            };
            const plistBuddy = new PlistBuddy({ nodeChildProcess: mockChildProcess });

            return plistBuddy.setPlistProperty(plistFileName, plistProperty, plistValue)
                .then(() => {
                    assert(mockedExecFunc.calledWithExactly(setCallArgs), "plistBuddy did not attempt to set first");
                    assert(mockedExecFunc.calledWithExactly(addCallArgs), "plistBuddy did not attempt to add after set failed");
                    assert.equal(mockedExecFunc.callCount, 2);
                });
        });

        test("setPlistProperty should stop after modifying if the attempt succeeds", function() {
            const plistFileName = "testFile.plist";
            const plistProperty = ":RCTDevMenu:ExecutorClass";
            const plistValue = "RCTWebSocketExecutor";

            const setCallArgs = `/usr/libexec/PlistBuddy -c 'Set ${plistProperty} ${plistValue}' '${plistFileName}'`;

            const mockedExecFunc = sinon.stub();
            mockedExecFunc.withArgs(setCallArgs).returns({ outcome: Q.resolve("stdout") });
            mockedExecFunc.throws();

            const mockChildProcess: any = {
                exec: mockedExecFunc,
            };
            const plistBuddy = new PlistBuddy({ nodeChildProcess: mockChildProcess });

            return plistBuddy.setPlistProperty(plistFileName, plistProperty, plistValue)
                .then(() => {
                    assert(mockedExecFunc.calledWithExactly(setCallArgs), "plistBuddy did not attempt to set first");
                    assert.equal(mockedExecFunc.callCount, 1);
                });
        });

        test("getBundleId should return the bundle ID", function() {
            const projectRoot = path.join("/", "userHome", "rnProject");
            const appName = "myApp";

            const infoPlistPath = (simulator: boolean) =>
                path.join(projectRoot, "build", "Build", "Products",
                    simulator ? "Debug-iphonesimulator" : "Debug-iphoneos",
                    `${appName}.app`, "Info.plist");

            const simulatorBundleId = "com.contoso.simulator";
            const deviceBundleId = "com.contoso.device";

            const printExecCall = (simulator: boolean) => `/usr/libexec/PlistBuddy -c 'Print:CFBundleIdentifier' '${infoPlistPath(simulator)}'`;

            const mockedExecFunc = sinon.stub();
            mockedExecFunc.withArgs(printExecCall(true)).returns({outcome: Q.resolve(simulatorBundleId)});
            mockedExecFunc.withArgs(printExecCall(false)).returns({outcome: Q.resolve(deviceBundleId)});
            const mockChildProcess: any = {
                exec: mockedExecFunc,
            };

            const mockedFindXcodeprojFile = sinon.stub();
            mockedFindXcodeprojFile.withArgs(projectRoot).returns(Q.resolve({
                    filename: appName + ".xcodeproj",
                    filetype: ".xcodeproj",
                    projectName: appName
                }));
            const mockXcodeproj: any = {
                findXcodeprojFile: mockedFindXcodeprojFile,
            };
            const plistBuddy = new PlistBuddy({ nodeChildProcess: mockChildProcess, xcodeproj: mockXcodeproj });

            return Q.all([
                plistBuddy.getBundleId(projectRoot, true),
                plistBuddy.getBundleId(projectRoot, false),
            ]).spread((simulatorId, deviceId) => {
                assert.equal(simulatorBundleId, simulatorId);
                assert.equal(deviceBundleId, deviceId);
            });
        });
    });
});