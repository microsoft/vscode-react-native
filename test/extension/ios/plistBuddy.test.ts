// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { PlistBuddy } from "../../../src/extension/ios/plistBuddy";
import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as sinon from "sinon";
import { ConfigurationData } from "../../../src/extension/ios/plistBuddy";
import { ProjectVersionHelper } from "../../../src/common/projectVersionHelper";
import { PlatformType } from "../../../src/extension/launchArgs";

suite("plistBuddy", function () {
    suite("extensionContext", function () {
        enum AppleProjectType {
            appleTV,
            iOS,
            macOS,
        }

        let mockedExecFunc: Sinon.SinonStub;

        setup(() => {
            mockedExecFunc = sinon.stub();
        });
        teardown(() => {
            mockedExecFunc?.reset();
        });

        test("setPlistProperty should attempt to modify, then add, plist properties", async function () {
            const plistFileName = "testFile.plist";
            const plistProperty = ":RCTDevMenu:ExecutorClass";
            const plistValue = "RCTWebSocketExecutor";

            const setCallArgs = `/usr/libexec/PlistBuddy -c 'Set ${plistProperty} ${plistValue}' '${plistFileName}'`;
            const addCallArgs = `/usr/libexec/PlistBuddy -c 'Add ${plistProperty} string ${plistValue}' '${plistFileName}'`;

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
            const plistBuddy = new PlistBuddy({ nodeChildProcess: mockChildProcess });

            await plistBuddy.setPlistProperty(plistFileName, plistProperty, plistValue);
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

        test("setPlistProperty should stop after modifying if the attempt succeeds", async function () {
            const plistFileName = "testFile.plist";
            const plistProperty = ":RCTDevMenu:ExecutorClass";
            const plistValue = "RCTWebSocketExecutor";

            const setCallArgs = `/usr/libexec/PlistBuddy -c 'Set ${plistProperty} ${plistValue}' '${plistFileName}'`;

            mockedExecFunc
                .withArgs(setCallArgs)
                .returns(Promise.resolve({ outcome: Promise.resolve("stdout") }));
            mockedExecFunc.throws();

            const mockChildProcess: any = {
                exec: mockedExecFunc,
            };
            const plistBuddy = new PlistBuddy({ nodeChildProcess: mockChildProcess });

            await plistBuddy.setPlistProperty(plistFileName, plistProperty, plistValue);
            assert(
                mockedExecFunc.calledWithExactly(setCallArgs),
                "plistBuddy did not attempt to set first",
            );
            assert.strictEqual(mockedExecFunc.callCount, 1);
        });

        test("getBundleId should return the bundle ID for RN <0.59", async function () {
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
                AppleProjectType.iOS,
            );

            let getReactNativeVersionsStub = sinon
                .stub(ProjectVersionHelper, "getReactNativeVersions")
                .returns(
                    Promise.resolve({
                        reactNativeVersion: "0.58.5",
                        reactNativeWindowsVersion: "",
                    }),
                );
            let getConfigurationDataStub = sinon.stub(
                plistBuddy,
                "getConfigurationData",
                fakeGetConfigurationData,
            );

            const [simulatorId1, simulatorId2, deviceId1, deviceId2] = await Promise.all([
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    true,
                    "Debug",
                    appName,
                ),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    true,
                    "Debug",
                    appName,
                    "whateverScheme",
                ),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    false,
                    undefined,
                    appName,
                ),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    false,
                    undefined,
                    appName,
                    "whateverScheme",
                ),
            ]);
            getReactNativeVersionsStub.restore();
            getConfigurationDataStub.restore();
            assert.strictEqual(simulatorBundleId, simulatorId1);
            assert.strictEqual(simulatorBundleId, simulatorId2);
            assert.strictEqual(deviceBundleId, deviceId1);
            assert.strictEqual(deviceBundleId, deviceId2);
        });

        test("getBundleId should return the bundle ID for RN >=0.59", async function () {
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
                AppleProjectType.iOS,
            );

            const getReactNativeVersionsStub = sinon
                .stub(ProjectVersionHelper, "getReactNativeVersions")
                .returns(
                    Promise.resolve({
                        reactNativeVersion: "0.59.0",
                        reactNativeWindowsVersion: "",
                    }),
                );
            const getConfigurationDataStub = sinon.stub(
                plistBuddy,
                "getConfigurationData",
                fakeGetConfigurationData,
            );
            const getInferredSchemeStub = sinon
                .stub(plistBuddy, "getInferredScheme")
                .returns(scheme);

            const [simulatorId1, simulatorId2, deviceId1, deviceId2] = await Promise.all([
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    true,
                    "Debug",
                    appName,
                ),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    true,
                    "Debug",
                    appName,
                    scheme,
                ),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    false,
                    undefined,
                    appName,
                ),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    false,
                    undefined,
                    appName,
                    scheme,
                ),
            ]);
            getReactNativeVersionsStub.restore();
            getConfigurationDataStub.restore();
            getInferredSchemeStub.restore();
            assert.strictEqual(simulatorBundleId, simulatorId1);
            assert.strictEqual(simulatorBundleId, simulatorId2);
            assert.strictEqual(deviceBundleId, deviceId1);
            assert.strictEqual(deviceBundleId, deviceId2);
        });

        test("getBundleId should return the bundle ID for an AppleTV project using RN >=0.59", async function () {
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
                AppleProjectType.appleTV,
            );

            const getReactNativeVersionsStub = sinon
                .stub(ProjectVersionHelper, "getReactNativeVersions")
                .returns(
                    Promise.resolve({
                        reactNativeVersion: "0.59.0",
                        reactNativeWindowsVersion: "",
                    }),
                );
            const getConfigurationDataStub = sinon.stub(
                plistBuddy,
                "getConfigurationData",
                fakeGetConfigurationData,
            );
            const getInferredSchemeStub = sinon
                .stub(plistBuddy, "getInferredScheme")
                .returns(scheme);

            const [simulatorId1, simulatorId2, deviceId1, deviceId2] = await Promise.all([
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    true,
                    "Debug",
                    appName,
                ),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    true,
                    "Debug",
                    appName,
                    scheme,
                ),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    false,
                    undefined,
                    appName,
                ),
                plistBuddy.getBundleId(
                    iosProjectRoot,
                    projectRoot,
                    PlatformType.iOS,
                    false,
                    undefined,
                    appName,
                    scheme,
                ),
            ]);
            getReactNativeVersionsStub.restore();
            getConfigurationDataStub.restore();
            getInferredSchemeStub.restore();
            assert.strictEqual(simulatorBundleId, simulatorId1);
            assert.strictEqual(simulatorBundleId, simulatorId2);
            assert.strictEqual(deviceBundleId, deviceId1);
            assert.strictEqual(deviceBundleId, deviceId2);
        });

        test("getBundleId should return the bundle ID for a macOS project using RN >=0.59", async function () {
            const projectRoot = path.join("/", "userHome", "rnProject");
            const macosProjectRoot = path.join(projectRoot, "macos");
            const appName = "myApp";
            const scheme = "myCustomScheme-macOS";
            const simulatorBundleId = "";
            const deviceBundleId = "org.reactjs.native.rn-macos";
            const plistBuddy = getPlistBuddy(
                appName,
                macosProjectRoot,
                scheme,
                simulatorBundleId,
                deviceBundleId,
                AppleProjectType.macOS,
            );

            const getReactNativeVersionsStub = sinon
                .stub(ProjectVersionHelper, "getReactNativeVersions")
                .returns(
                    Promise.resolve({
                        reactNativeVersion: "0.61.0",
                        reactNativeWindowsVersion: "",
                    }),
                );
            const getConfigurationDataStub = sinon.stub(
                plistBuddy,
                "getConfigurationData",
                fakeGetConfigurationData,
            );
            const getInferredSchemeStub = sinon
                .stub(plistBuddy, "getInferredScheme")
                .returns("myCustomScheme");

            const [bundleId1, bundleId2] = await Promise.all([
                plistBuddy.getBundleId(
                    macosProjectRoot,
                    projectRoot,
                    PlatformType.macOS,
                    false,
                    undefined,
                    appName,
                ),
                plistBuddy.getBundleId(
                    macosProjectRoot,
                    projectRoot,
                    PlatformType.macOS,
                    false,
                    "Debug",
                    appName,
                    scheme,
                ),
            ]);
            getReactNativeVersionsStub.restore();
            getConfigurationDataStub.restore();
            getInferredSchemeStub.restore();
            assert.strictEqual(deviceBundleId, bundleId1);
            assert.strictEqual(deviceBundleId, bundleId2);
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
            const plistBuddy = new PlistBuddy();
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
            platformProjectRoot: string,
            configuration: string,
            scheme: string | undefined,
            oldConfigurationFolder: string,
            sdkType?: string,
        ): ConfigurationData {
            return {
                fullProductName: "",
                configurationFolder: oldConfigurationFolder,
            };
        }

        function getPlistBuddy(
            appName: string,
            platformProjectRoot: string,
            scheme: string | undefined,
            simulatorBundleId: string,
            deviceBundleId: string,
            appType: AppleProjectType,
        ) {
            const infoPlistPath = (simulator: boolean) => {
                let plistPath = scheme
                    ? path.join(platformProjectRoot, "build", scheme, "Build", "Products")
                    : path.join(platformProjectRoot, "build", "Build", "Products");
                switch (appType) {
                    case AppleProjectType.appleTV:
                        plistPath = path.join(
                            plistPath,
                            `Debug-appletv${simulator ? "simulator" : "os"}`,
                            `${appName}.app`,
                            "Info.plist",
                        );
                        break;
                    case AppleProjectType.iOS:
                        plistPath = path.join(
                            plistPath,
                            `Debug-iphone${simulator ? "simulator" : "os"}`,
                            `${appName}.app`,
                            "Info.plist",
                        );
                        break;
                    case AppleProjectType.macOS:
                        plistPath = path.join(
                            plistPath,
                            "Debug",
                            `${appName}.app`,
                            "Contents",
                            "Info.plist",
                        );
                        break;
                }
                return plistPath;
            };

            const printExecCall = (simulator: boolean) =>
                `/usr/libexec/PlistBuddy -c 'Print:CFBundleIdentifier' '${infoPlistPath(
                    simulator,
                )}'`;

            mockedExecFunc
                .withArgs(printExecCall(true))
                .returns(Promise.resolve({ outcome: Promise.resolve(simulatorBundleId) }));
            mockedExecFunc
                .withArgs(printExecCall(false))
                .returns(Promise.resolve({ outcome: Promise.resolve(deviceBundleId) }));
            const mockChildProcess: any = {
                exec: mockedExecFunc,
            };

            return new PlistBuddy({ nodeChildProcess: mockChildProcess });
        }
    });
});
