// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {PlistBuddy} from "../../../src/extension/ios/plistBuddy";

import * as assert from "assert";
import * as path from "path";
import * as Q from "q";
import * as sinon from "sinon";
import { ReactNativeProjectHelper } from "../../../src/common/reactNativeProjectHelper";


suite("plistBuddy", function() {
    suite("extensionContext", function() {
        const sandbox = sinon.sandbox.create();
        teardown(() => {
            sandbox.restore();
        });

        test("setPlistProperty should attempt to modify, then add, plist properties", function() {
            const plistFileName = "testFile.plist";
            const plistProperty = ":RCTDevMenu:ExecutorClass";
            const plistValue = "RCTWebSocketExecutor";

            const setCallArgs = `/usr/libexec/PlistBuddy -c 'Set ${plistProperty} ${plistValue}' '${plistFileName}'`;
            const addCallArgs = `/usr/libexec/PlistBuddy -c 'Add ${plistProperty} string ${plistValue}' '${plistFileName}'`;

            const mockedExecFunc = sandbox.stub();
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

            const mockedExecFunc = sandbox.stub();
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

        test("getBundleId should return the bundle ID for RN <0.59", function() {
            const projectRoot = path.join("/", "userHome", "rnProject");
            const iosProjectRoot = path.join(projectRoot, "ios");
            const appName = "myApp";
            const simulatorBundleId = "com.contoso.simulator";
            const deviceBundleId = "com.contoso.device";
            const plistBuddy = getPlistBuddy(appName, iosProjectRoot, undefined, simulatorBundleId, deviceBundleId);

            sandbox.stub(ReactNativeProjectHelper, "getReactNativeVersions").returns(Q.resolve({reactNativeVersion: "0.58.5", reactNativeWindowsVersion: ""}));

            return Q.all([
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, true, "Debug", appName),
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, true, "Debug", appName, "whateverScheme"),
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, false, undefined, appName),
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, false, undefined, appName, "whateverScheme"),
            ]).spread((simulatorId1, simulatorId2, deviceId1, deviceId2) => {
                assert.equal(simulatorBundleId, simulatorId1);
                assert.equal(simulatorBundleId, simulatorId2);
                assert.equal(deviceBundleId, deviceId1);
                assert.equal(deviceBundleId, deviceId2);
            });
        });

        test("getBundleId should return the bundle ID for RN >=0.59", function() {
            const projectRoot = path.join("/", "userHome", "rnProject");
            const iosProjectRoot = path.join(projectRoot, "ios");
            const appName = "myApp";
            const scheme = "myCustomScheme";
            const simulatorBundleId = "com.contoso.simulator";
            const deviceBundleId = "com.contoso.device";
            const plistBuddy = getPlistBuddy(appName, iosProjectRoot, "myCustomScheme", simulatorBundleId, deviceBundleId);

            sandbox.stub(ReactNativeProjectHelper, "getReactNativeVersions").returns(Q.resolve({reactNativeVersion: "0.59.0", reactNativeWindowsVersion: ""}));
            sandbox.stub(plistBuddy, "getInferredScheme").returns(scheme);

            return Q.all([
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, true, "Debug", appName),
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, true, "Debug", appName, scheme),
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, false, undefined, appName),
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, false, undefined, appName, scheme),
            ]).spread((simulatorId1, simulatorId2, deviceId1, deviceId2) => {
                assert.equal(simulatorBundleId, simulatorId1);
                assert.equal(simulatorBundleId, simulatorId2);
                assert.equal(deviceBundleId, deviceId1);
                assert.equal(deviceBundleId, deviceId2);
            });
        });

        function getPlistBuddy(appName: string, iosProjectRoot: string, scheme: string | undefined, simulatorBundleId: string, deviceBundleId: string) {
            const infoPlistPath = (simulator: boolean) =>
                scheme
                    ?
                    path.join(iosProjectRoot, "build", scheme, "Build", "Products",
                        simulator ? "Debug-iphonesimulator" : "Debug-iphoneos",
                        `${appName}.app`, "Info.plist")
                    :
                    path.join(iosProjectRoot, "build", "Build", "Products",
                        simulator ? "Debug-iphonesimulator" : "Debug-iphoneos",
                        `${appName}.app`, "Info.plist");

            const printExecCall = (simulator: boolean) => `/usr/libexec/PlistBuddy -c 'Print:CFBundleIdentifier' '${infoPlistPath(simulator)}'`;
            const mockedExecFunc = sandbox.stub();
            mockedExecFunc.withArgs(printExecCall(true)).returns({outcome: Q.resolve(simulatorBundleId)});
            mockedExecFunc.withArgs(printExecCall(false)).returns({outcome: Q.resolve(deviceBundleId)});
            const mockChildProcess: any = {
                exec: mockedExecFunc,
            };

            return new PlistBuddy({ nodeChildProcess: mockChildProcess });
        }
    });
});