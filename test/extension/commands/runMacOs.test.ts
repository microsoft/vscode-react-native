// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("runMacOsCommand", function () {
    const PlatformType = {
        macOS: "macos",
    };
    const reactNativeMacOsPackage = { name: "react-native-macos" };

    function createMockProject(nodeModulesRoot = "project/node_modules") {
        const packager = {};

        return {
            project: {
                getOrUpdateNodeModulesRoot: Sinon.stub().returns(nodeModulesRoot),
                setReactNativeVersions: Sinon.stub(),
                getPackager: Sinon.stub().returns(packager),
            },
            packager,
            nodeModulesRoot,
        };
    }

    function createCommandModule() {
        const superOnBeforeExecuteStub = Sinon.stub().returns(Promise.resolve());
        const getVersionsStub = Sinon.stub().returns(
            Promise.resolve({ reactNativeVersion: "1.0.0" }),
        );
        const checkTargetPlatformSupportStub = Sinon.stub();
        const setKnownDateForFeatureByIdStub = Sinon.stub().returns(Promise.resolve());
        const getRunOptionsStub = Sinon.stub().returns({ projectRoot: "project" });
        const macOsPlatformConstructorStub = Sinon.stub();
        const beforeStartPackagerStub = Sinon.stub().returns(Promise.resolve());
        const startPackagerStub = Sinon.stub().returns(Promise.resolve());
        const disableJSDebuggingModeStub = Sinon.stub().returns(Promise.resolve());
        const runAppStub = Sinon.stub().returns(Promise.resolve());

        class FakeReactNativeCommand {
            public project: any;

            static formInstance(): any {
                return new this();
            }

            async onBeforeExecute(): Promise<void> {
                await superOnBeforeExecuteStub();
            }
        }

        class FakeMacOSPlatform {
            public beforeStartPackager = beforeStartPackagerStub;
            public startPackager = startPackagerStub;
            public disableJSDebuggingMode = disableJSDebuggingModeStub;
            public runApp = runAppStub;

            constructor(runOptions: unknown, context: unknown) {
                macOsPlatformConstructorStub(runOptions, context);
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/runMacOs", {
            "../../common/projectVersionHelper": {
                ProjectVersionHelper: {
                    getReactNativePackageVersionsFromNodeModules: getVersionsStub,
                },
                REACT_NATIVE_PACKAGES: {
                    REACT_NATIVE_MACOS: reactNativeMacOsPackage,
                },
            },
            "../../common/targetPlatformHelper": {
                TargetPlatformHelper: {
                    checkTargetPlatformSupport: checkTargetPlatformSupportStub,
                },
            },
            "../launchArgs": {
                PlatformType,
            },
            "../macos/macOSPlatform": {
                MacOSPlatform: FakeMacOSPlatform,
            },
            "../services/tipsNotificationsService/tipsNotificationService": {
                TipNotificationService: {
                    getInstance: Sinon.stub().returns({
                        setKnownDateForFeatureById: setKnownDateForFeatureByIdStub,
                    }),
                },
            },
            "./util": {
                getRunOptions: getRunOptionsStub,
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/runMacOs");

        return {
            RunMacOS: module.RunMacOS,
            superOnBeforeExecuteStub,
            getVersionsStub,
            checkTargetPlatformSupportStub,
            setKnownDateForFeatureByIdStub,
            getRunOptionsStub,
            macOsPlatformConstructorStub,
            beforeStartPackagerStub,
            startPackagerStub,
            disableJSDebuggingModeStub,
            runAppStub,
        };
    }

    async function runCommand(stubs: ReturnType<typeof createCommandModule>, project: any) {
        const command = stubs.RunMacOS.formInstance() as any;
        command.project = project;
        await command.baseFn();
    }

    test("should run macOS after preparing the packager", async function () {
        const stubs = createCommandModule();
        const { project, packager } = createMockProject();

        await runCommand(stubs, project);

        assert.strictEqual(
            stubs.getRunOptionsStub.calledWithExactly(project, PlatformType.macOS),
            true,
        );
        assert.deepStrictEqual(stubs.macOsPlatformConstructorStub.firstCall.args, [
            { projectRoot: "project" },
            { packager },
        ]);
        assert.strictEqual(stubs.beforeStartPackagerStub.calledOnce, true);
        assert.strictEqual(stubs.startPackagerStub.calledOnce, true);
        assert.strictEqual(stubs.disableJSDebuggingModeStub.calledOnce, true);
        assert.strictEqual(stubs.runAppStub.calledOnce, true);
        assert.strictEqual(
            stubs.beforeStartPackagerStub.calledBefore(stubs.startPackagerStub),
            true,
        );
        assert.strictEqual(
            stubs.startPackagerStub.calledBefore(stubs.disableJSDebuggingModeStub),
            true,
        );
        assert.strictEqual(stubs.disableJSDebuggingModeStub.calledBefore(stubs.runAppStub), true);
    });

    test("should prepare React Native versions and validate macOS support", async function () {
        const stubs = createCommandModule();
        const { project, nodeModulesRoot } = createMockProject();
        const command = stubs.RunMacOS.formInstance() as any;
        command.project = project;

        await command.onBeforeExecute();

        assert.strictEqual(stubs.superOnBeforeExecuteStub.calledOnce, true);
        assert.strictEqual(
            stubs.setKnownDateForFeatureByIdStub.calledWithExactly("debuggingRNWAndMacOSApps"),
            true,
        );
        assert.strictEqual(
            stubs.checkTargetPlatformSupportStub.calledWithExactly(PlatformType.macOS),
            true,
        );
        assert.strictEqual(
            stubs.getVersionsStub.calledWithExactly(nodeModulesRoot, [reactNativeMacOsPackage]),
            true,
        );
        assert.deepStrictEqual(project.setReactNativeVersions.firstCall.args, [
            { reactNativeVersion: "1.0.0" },
        ]);
    });

    const preparationFailureCases: Array<{
        name: string;
        failingStub: (stubs: ReturnType<typeof createCommandModule>) => Sinon.SinonStub;
        subsequentStubs: (stubs: ReturnType<typeof createCommandModule>) => Sinon.SinonStub[];
    }> = [
        {
            name: "packager preparation",
            failingStub: stubs => stubs.beforeStartPackagerStub,
            subsequentStubs: stubs => [stubs.startPackagerStub, stubs.disableJSDebuggingModeStub],
        },
        {
            name: "packager startup",
            failingStub: stubs => stubs.startPackagerStub,
            subsequentStubs: stubs => [stubs.disableJSDebuggingModeStub],
        },
        {
            name: "debug mode update",
            failingStub: stubs => stubs.disableJSDebuggingModeStub,
            subsequentStubs: () => [],
        },
    ];

    for (const failureCase of preparationFailureCases) {
        test(`should run the macOS app when ${failureCase.name} fails`, async function () {
            const stubs = createCommandModule();
            const { project } = createMockProject();
            failureCase
                .failingStub(stubs)
                .returns(Promise.reject(new Error(`failed during ${failureCase.name}`)));

            await runCommand(stubs, project);

            for (const subsequentStub of failureCase.subsequentStubs(stubs)) {
                assert.strictEqual(subsequentStub.called, false);
            }
            assert.strictEqual(stubs.runAppStub.calledOnce, true);
        });
    }

    test("should propagate app launch errors", async function () {
        const error = new Error("failed to run macOS app");
        const stubs = createCommandModule();
        const { project } = createMockProject();
        stubs.runAppStub.returns(Promise.reject(error));

        await assert.rejects(() => runCommand(stubs, project), error);
    });
});
