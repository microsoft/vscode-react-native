// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { PlistBuddy } from "../../../src/extension/ios/plistBuddy";
import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as sinon from "sinon";
import { ConfigurationData } from "../../../src/extension/ios/plistBuddy";
import { ProjectVersionHelper } from "../../../src/common/projectVersionHelper";

suite("plistBuddy", function () {
    suite("extensionContext", function () {
        const sandbox = sinon.sandbox.create();
        teardown(() => {
            sandbox.restore();
        });

        test("setPlistProperty should attempt to modify, then add, plist properties", function () {
            const plistFileName = "testFile.plist";
            const plistProperty = ":RCTDevMenu:ExecutorClass";
            const plistValue = "RCTWebSocketExecutor";

            const setCallArgs = `/usr/libexec/PlistBuddy -c 'Set ${plistProperty} ${plistValue}' '${plistFileName}'`;
            const addCallArgs = `/usr/libexec/PlistBuddy -c 'Add ${plistProperty} string ${plistValue}' '${plistFileName}'`;

            const mockedExecFunc = sandbox.stub();
            mockedExecFunc.withArgs(setCallArgs).returns(
                Promise.resolve({
                    outcome: Promise.reject(new Error("Setting does not exist")),
                }),
            );
            mockedExecFunc
                .withArgs(addCallArgs)
                .returns(Promise.resolve({ outcome: Promise.resolve("stdout") }));
            mockedExecFunc.throws();

            const mockChildProcess: any = {
                exec: mockedExecFunc,
            };
            const plistBuddy = new PlistBuddy({ nodeChildProcess: mockChildProcess }, "");

            return plistBuddy
                .setPlistProperty(plistFileName, plistProperty, plistValue)
                .then(() => {
                    assert(
                        mockedExecFunc.calledWithExactly(setCallArgs),
                        "plistBuddy did not attempt to set first",
                    );
                    assert(
                        mockedExecFunc.calledWithExactly(addCallArgs),
                        "plistBuddy did not attempt to add after set failed",
                    );
                    assert.strictEqual(mockedExecFunc.callCount, 2);
                });
        });

        test("setPlistProperty should stop after modifying if the attempt succeeds", function () {
            const plistFileName = "testFile.plist";
            const plistProperty = ":RCTDevMenu:ExecutorClass";
            const plistValue = "RCTWebSocketExecutor";

            const setCallArgs = `/usr/libexec/PlistBuddy -c 'Set ${plistProperty} ${plistValue}' '${plistFileName}'`;

            const mockedExecFunc = sandbox.stub();
            mockedExecFunc
                .withArgs(setCallArgs)
                .returns(Promise.resolve({ outcome: Promise.resolve("stdout") }));
            mockedExecFunc.throws();

            const mockChildProcess: any = {
                exec: mockedExecFunc,
            };
            const plistBuddy = new PlistBuddy({ nodeChildProcess: mockChildProcess }, "");

            return plistBuddy
                .setPlistProperty(plistFileName, plistProperty, plistValue)
                .then(() => {
                    assert(
                        mockedExecFunc.calledWithExactly(setCallArgs),
                        "plistBuddy did not attempt to set first",
                    );
                    assert.strictEqual(mockedExecFunc.callCount, 1);
                });
        });

        test("getBundleId should return the bundle ID for RN <0.59", function () {
            const projectRoot = path.join("/", "userHome", "rnProject");
            const iosProjectRoot = path.join(projectRoot, "ios");
            const appName = "myApp";
            const simulatorBundleId = "com.contoso.simulator";
            const deviceBundleId = "com.contoso.device";
            const plistBuddy = getPlistBuddy(
                appName,
                iosProjectRoot,
                undefined,
                simulatorBundleId,
                deviceBundleId,
            );

            sandbox.stub(ProjectVersionHelper, "getReactNativeVersions").returns(
                Promise.resolve({
                    reactNativeVersion: "0.58.5",
                    reactNativeWindowsVersion: "",
                }),
            );
            sandbox.stub(plistBuddy, "getConfigurationData", fakeGetConfigurationData);

            return Promise.all([
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, true, "Debug", appName),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    true,
                    "Debug",
                    appName,
                    "whateverScheme",
                ),
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, false, undefined, appName),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    false,
                    undefined,
                    appName,
                    "whateverScheme",
                ),
            ]).then(([simulatorId1, simulatorId2, deviceId1, deviceId2]) => {
                assert.strictEqual(simulatorBundleId, simulatorId1);
                assert.strictEqual(simulatorBundleId, simulatorId2);
                assert.strictEqual(deviceBundleId, deviceId1);
                assert.strictEqual(deviceBundleId, deviceId2);
            });
        });

        test("getBundleId should return the bundle ID for RN >=0.59", function () {
            const projectRoot = path.join("/", "userHome", "rnProject");
            const iosProjectRoot = path.join(projectRoot, "ios");
            const appName = "myApp";
            const scheme = "myCustomScheme";
            const simulatorBundleId = "com.contoso.simulator";
            const deviceBundleId = "com.contoso.device";
            const plistBuddy = getPlistBuddy(
                appName,
                iosProjectRoot,
                "myCustomScheme",
                simulatorBundleId,
                deviceBundleId,
            );

            sandbox.stub(ProjectVersionHelper, "getReactNativeVersions").returns(
                Promise.resolve({
                    reactNativeVersion: "0.59.0",
                    reactNativeWindowsVersion: "",
                }),
            );
            sandbox.stub(plistBuddy, "getConfigurationData", fakeGetConfigurationData);
            sandbox.stub(plistBuddy, "getInferredScheme").returns(scheme);

            return Promise.all([
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, true, "Debug", appName),
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, true, "Debug", appName, scheme),
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, false, undefined, appName),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    false,
                    undefined,
                    appName,
                    scheme,
                ),
            ]).then(([simulatorId1, simulatorId2, deviceId1, deviceId2]) => {
                assert.strictEqual(simulatorBundleId, simulatorId1);
                assert.strictEqual(simulatorBundleId, simulatorId2);
                assert.strictEqual(deviceBundleId, deviceId1);
                assert.strictEqual(deviceBundleId, deviceId2);
            });
        });

        test("getBundleId should return the bundle ID for an AppleTV project using RN >=0.59", function () {
            const projectRoot = path.join("/", "userHome", "rnProject");
            const iosProjectRoot = path.join(projectRoot, "ios");
            const appName = "myApp";
            const scheme = "myCustomScheme-tvOS";
            const simulatorBundleId = "com.contoso.simulator";
            const deviceBundleId = "com.contoso.device";
            const plistBuddy = getPlistBuddy(
                appName,
                iosProjectRoot,
                scheme,
                simulatorBundleId,
                deviceBundleId,
                true,
            );

            sandbox.stub(ProjectVersionHelper, "getReactNativeVersions").returns(
                Promise.resolve({
                    reactNativeVersion: "0.59.0",
                    reactNativeWindowsVersion: "",
                }),
            );
            sandbox.stub(plistBuddy, "getConfigurationData", fakeGetConfigurationData);
            sandbox.stub(plistBuddy, "getInferredScheme").returns(scheme);

            return Promise.all([
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, true, "Debug", appName),
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, true, "Debug", appName, scheme),
                plistBuddy.getBundleId(iosProjectRoot, projectRoot, false, undefined, appName),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    false,
                    undefined,
                    appName,
                    scheme,
                ),
            ]).then(([simulatorId1, simulatorId2, deviceId1, deviceId2]) => {
                assert.strictEqual(simulatorBundleId, simulatorId1);
                assert.strictEqual(simulatorBundleId, simulatorId2);
                assert.strictEqual(deviceBundleId, deviceId1);
                assert.strictEqual(deviceBundleId, deviceId2);
            });
        });

        suite("fetchParameterFromBuildSettings", function () {
            const buildSettingsFile = path.join(
                __dirname,
                "..",
                "..",
                "resources",
                "auxiliaryFiles",
                "buildSettings.txt",
            );
            const plistBuddy = new PlistBuddy(undefined, "");
            let buildSettings: string | Buffer;

            suiteSetup(() => {
                buildSettings = fs.readFileSync(buildSettingsFile);
            });

            test("fetchParameterFromBuildSettings should return parameter value", function () {
                const targetBuildDirRef =
                    "/Users/user/Library/Developer/Xcode/DerivedData/AwesomeProject0615-btdtcysqbddifyewiiztkumnopik/Build/Products/Debug-iphonesimulator";
                const fullProductNameRef = "AwesomeProject0615.app";

                const targetBuildDir = plistBuddy.fetchParameterFromBuildSettings(
                    <string>buildSettings,
                    "TARGET_BUILD_DIR",
                );
                const fullProductName = plistBuddy.fetchParameterFromBuildSettings(
                    <string>buildSettings,
                    "FULL_PRODUCT_NAME",
                );

                assert.strictEqual(targetBuildDir, targetBuildDirRef);
                assert.strictEqual(fullProductName, fullProductNameRef);
            });

            test("fetchParameterFromBuildSettings should return null", function () {
                const targetBuildDir = plistBuddy.fetchParameterFromBuildSettings(
                    <string>buildSettings,
                    "TARGET_BUILD_DIR1",
                );
                const testNull = plistBuddy.fetchParameterFromBuildSettings(
                    <string>buildSettings,
                    "TEST",
                );
                const emptyStringCase = plistBuddy.fetchParameterFromBuildSettings(
                    <string>buildSettings,
                    "",
                );

                assert.strictEqual(targetBuildDir, null);
                assert.strictEqual(testNull, null);
                assert.notStrictEqual(emptyStringCase, null);
            });
        });

        function fakeGetConfigurationData(
            projectRoot: string,
            reactNativeVersion: string,
            iosProjectRoot: string,
            configuration: string,
            scheme: string | undefined,
            sdkType: string,
            oldConfigurationFolder: string,
        ): ConfigurationData {
            return {
                fullProductName: "",
                configurationFolder: oldConfigurationFolder,
            };
        }

        function getPlistBuddy(
            appName: string,
            iosProjectRoot: string,
            scheme: string | undefined,
            simulatorBundleId: string,
            deviceBundleId: string,
            isTV: boolean = false,
        ) {
            const deviceType = isTV ? "appletv" : "iphone";
            const infoPlistPath = (simulator: boolean) =>
                scheme
                    ? path.join(
                          iosProjectRoot,
                          "build",
                          scheme,
                          "Build",
                          "Products",
                          `Debug-${deviceType}${simulator ? "simulator" : "os"}`,
                          `${appName}.app`,
                          "Info.plist",
                      )
                    : path.join(
                          iosProjectRoot,
                          "build",
                          "Build",
                          "Products",
                          `Debug-${deviceType}${simulator ? "simulator" : "os"}`,
                          `${appName}.app`,
                          "Info.plist",
                      );

            const printExecCall = (simulator: boolean) =>
                `/usr/libexec/PlistBuddy -c 'Print:CFBundleIdentifier' '${infoPlistPath(
                    simulator,
                )}'`;
            const mockedExecFunc = sandbox.stub();
            mockedExecFunc
                .withArgs(printExecCall(true))
                .returns(Promise.resolve({ outcome: Promise.resolve(simulatorBundleId) }));
            mockedExecFunc
                .withArgs(printExecCall(false))
                .returns(Promise.resolve({ outcome: Promise.resolve(deviceBundleId) }));
            const mockChildProcess: any = {
                exec: mockedExecFunc,
            };

            return new PlistBuddy({ nodeChildProcess: mockChildProcess }, "");
        }
    });
});
