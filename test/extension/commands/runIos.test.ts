// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("runIosCommand", function () {
    const TargetType = {
        Device: "device",
        Simulator: "simulator",
    };
    const PlatformType = {
        iOS: "ios",
    };

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
        const getRunOptionsStub = Sinon.stub().returns({ projectRoot: "project" });
        const iosPlatformConstructorStub = Sinon.stub();
        const resolveMobileTargetStub = Sinon.stub().returns(Promise.resolve());
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

        class FakeIOSPlatform {
            public resolveMobileTarget = resolveMobileTargetStub;
            public beforeStartPackager = beforeStartPackagerStub;
            public startPackager = startPackagerStub;
            public disableJSDebuggingMode = disableJSDebuggingModeStub;
            public runApp = runAppStub;

            constructor(runOptions: unknown, context: unknown) {
                iosPlatformConstructorStub(runOptions, context);
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/runIos", {
            "../../common/projectVersionHelper": {
                ProjectVersionHelper: {
                    getReactNativePackageVersionsFromNodeModules: getVersionsStub,
                },
            },
            "../../common/targetPlatformHelper": {
                TargetPlatformHelper: {
                    checkTargetPlatformSupport: checkTargetPlatformSupportStub,
                },
            },
            "../appLauncher": {
                AppLauncher: class {},
            },
            "../generalPlatform": {
                TargetType,
            },
            "../ios/iOSPlatform": {
                IOSPlatform: FakeIOSPlatform,
            },
            "../launchArgs": {
                PlatformType,
            },
            "./util": {
                getRunOptions: getRunOptionsStub,
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/runIos");

        return {
            RunIosDevice: module.RunIosDevice,
            RunIosSimulator: module.RunIosSimulator,
            superOnBeforeExecuteStub,
            getVersionsStub,
            checkTargetPlatformSupportStub,
            getRunOptionsStub,
            iosPlatformConstructorStub,
            resolveMobileTargetStub,
            beforeStartPackagerStub,
            startPackagerStub,
            disableJSDebuggingModeStub,
            runAppStub,
        };
    }

    async function runCommand(commandClass: any, project: any): Promise<void> {
        const command = commandClass.formInstance();
        command.project = project;
        await command.baseFn();
    }

    function assertPlatformFlow(stubs: ReturnType<typeof createCommandModule>, target: string) {
        assert.strictEqual(stubs.resolveMobileTargetStub.calledWithExactly(target), true);
        assert.strictEqual(stubs.beforeStartPackagerStub.calledOnce, true);
        assert.strictEqual(stubs.startPackagerStub.calledOnce, true);
        assert.strictEqual(stubs.disableJSDebuggingModeStub.calledOnce, true);
        assert.strictEqual(stubs.runAppStub.calledOnce, true);
        assert.strictEqual(
            stubs.resolveMobileTargetStub.calledBefore(stubs.beforeStartPackagerStub),
            true,
        );
        assert.strictEqual(
            stubs.beforeStartPackagerStub.calledBefore(stubs.startPackagerStub),
            true,
        );
        assert.strictEqual(
            stubs.startPackagerStub.calledBefore(stubs.disableJSDebuggingModeStub),
            true,
        );
        assert.strictEqual(stubs.disableJSDebuggingModeStub.calledBefore(stubs.runAppStub), true);
    }

    const preparationFailureCases: Array<{
        name: string;
        failingStub: (stubs: ReturnType<typeof createCommandModule>) => Sinon.SinonStub;
        subsequentStubs: (stubs: ReturnType<typeof createCommandModule>) => Sinon.SinonStub[];
    }> = [
        {
            name: "target resolution",
            failingStub: stubs => stubs.resolveMobileTargetStub,
            subsequentStubs: stubs => [
                stubs.beforeStartPackagerStub,
                stubs.startPackagerStub,
                stubs.disableJSDebuggingModeStub,
            ],
        },
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

    test("should run iOS on a connected device", async function () {
        const stubs = createCommandModule();
        const { project, packager } = createMockProject();

        await runCommand(stubs.RunIosDevice, project);

        assert.strictEqual(
            stubs.getRunOptionsStub.calledWithExactly(project, PlatformType.iOS, TargetType.Device),
            true,
        );
        assert.deepStrictEqual(stubs.iosPlatformConstructorStub.firstCall.args, [
            { projectRoot: "project" },
            { packager },
        ]);
        assertPlatformFlow(stubs, TargetType.Device);
    });

    test("should run iOS on a simulator", async function () {
        const stubs = createCommandModule();
        const { project } = createMockProject();

        await runCommand(stubs.RunIosSimulator, project);

        assert.strictEqual(
            stubs.getRunOptionsStub.calledWithExactly(
                project,
                PlatformType.iOS,
                TargetType.Simulator,
            ),
            true,
        );
        assertPlatformFlow(stubs, TargetType.Simulator);
    });

    test("should prepare React Native versions and validate iOS support", async function () {
        const stubs = createCommandModule();
        const { project, nodeModulesRoot } = createMockProject();
        const command = stubs.RunIosDevice.formInstance() as any;
        command.project = project;

        await command.onBeforeExecute();

        assert.strictEqual(stubs.superOnBeforeExecuteStub.calledOnce, true);
        assert.strictEqual(project.getOrUpdateNodeModulesRoot.calledOnce, true);
        assert.strictEqual(stubs.getVersionsStub.calledWithExactly(nodeModulesRoot), true);
        assert.deepStrictEqual(project.setReactNativeVersions.firstCall.args, [
            { reactNativeVersion: "1.0.0" },
        ]);
        assert.strictEqual(
            stubs.checkTargetPlatformSupportStub.calledWithExactly(PlatformType.iOS),
            true,
        );
        assert.strictEqual(
            project.setReactNativeVersions.calledBefore(stubs.checkTargetPlatformSupportStub),
            true,
        );
    });

    test("should stop preparation when project selection is canceled", async function () {
        const error = new Error("project selection canceled");
        const stubs = createCommandModule();
        const { project } = createMockProject();
        const command = stubs.RunIosDevice.formInstance() as any;
        command.project = project;
        stubs.superOnBeforeExecuteStub.returns(Promise.reject(error));

        await assert.rejects(() => command.onBeforeExecute(), error);

        assert.strictEqual(project.getOrUpdateNodeModulesRoot.called, false);
        assert.strictEqual(stubs.getVersionsStub.called, false);
        assert.strictEqual(stubs.checkTargetPlatformSupportStub.called, false);
    });

    test("should stop preparation when reading React Native versions fails", async function () {
        const error = new Error("failed to read React Native versions");
        const stubs = createCommandModule();
        const { project } = createMockProject();
        const command = stubs.RunIosDevice.formInstance() as any;
        command.project = project;
        stubs.getVersionsStub.returns(Promise.reject(error));

        await assert.rejects(() => command.onBeforeExecute(), error);

        assert.strictEqual(project.setReactNativeVersions.called, false);
        assert.strictEqual(stubs.checkTargetPlatformSupportStub.called, false);
    });

    test("should propagate iOS platform support errors", async function () {
        const error = new Error("iOS is not supported");
        const stubs = createCommandModule();
        const { project } = createMockProject();
        const command = stubs.RunIosDevice.formInstance() as any;
        command.project = project;
        stubs.checkTargetPlatformSupportStub.throws(error);

        await assert.rejects(() => command.onBeforeExecute(), error);

        assert.strictEqual(project.setReactNativeVersions.calledOnce, true);
    });

    for (const failureCase of preparationFailureCases) {
        test(`should run the iOS app when ${failureCase.name} fails`, async function () {
            const error = new Error(`failed during ${failureCase.name}`);
            const stubs = createCommandModule();
            const { project } = createMockProject();
            failureCase.failingStub(stubs).returns(Promise.reject(error));

            await runCommand(stubs.RunIosDevice, project);

            for (const subsequentStub of failureCase.subsequentStubs(stubs)) {
                assert.strictEqual(subsequentStub.called, false);
            }
            assert.strictEqual(stubs.runAppStub.calledOnce, true);
        });
    }

    test("should propagate app launch errors", async function () {
        const error = new Error("failed to run iOS app");
        const stubs = createCommandModule();
        const { project } = createMockProject();
        stubs.runAppStub.returns(Promise.reject(error));

        await assert.rejects(() => runCommand(stubs.RunIosDevice, project), error);
    });
});
