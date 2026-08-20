// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("runWindowsCommand", function () {
    const PlatformType = {
        Windows: "windows",
    };
    const reactNativeWindowsPackage = { name: "react-native-windows" };

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
        const windowsPlatformConstructorStub = Sinon.stub();
        const beforeStartPackagerStub = Sinon.stub().returns(Promise.resolve());
        const startPackagerStub = Sinon.stub().returns(Promise.resolve());
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

        class FakeWindowsPlatform {
            public beforeStartPackager = beforeStartPackagerStub;
            public startPackager = startPackagerStub;
            public runApp = runAppStub;

            constructor(runOptions: unknown, context: unknown) {
                windowsPlatformConstructorStub(runOptions, context);
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/runWindows", {
            "../../common/projectVersionHelper": {
                ProjectVersionHelper: {
                    getReactNativePackageVersionsFromNodeModules: getVersionsStub,
                },
                REACT_NATIVE_PACKAGES: {
                    REACT_NATIVE_WINDOWS: reactNativeWindowsPackage,
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
            "../services/tipsNotificationsService/tipsNotificationService": {
                TipNotificationService: {
                    getInstance: Sinon.stub().returns({
                        setKnownDateForFeatureById: setKnownDateForFeatureByIdStub,
                    }),
                },
            },
            "../windows/windowsPlatform": {
                WindowsPlatform: FakeWindowsPlatform,
            },
            "./util": {
                getRunOptions: getRunOptionsStub,
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/runWindows");

        return {
            RunWindows: module.RunWindows,
            superOnBeforeExecuteStub,
            getVersionsStub,
            checkTargetPlatformSupportStub,
            setKnownDateForFeatureByIdStub,
            getRunOptionsStub,
            windowsPlatformConstructorStub,
            beforeStartPackagerStub,
            startPackagerStub,
            runAppStub,
        };
    }

    async function runCommand(stubs: ReturnType<typeof createCommandModule>, project: any) {
        const command = stubs.RunWindows.formInstance() as any;
        command.project = project;
        await command.baseFn();
    }

    test("should run Windows after preparing the packager", async function () {
        const stubs = createCommandModule();
        const { project, packager } = createMockProject();

        await runCommand(stubs, project);

        assert.strictEqual(
            stubs.getRunOptionsStub.calledWithExactly(project, PlatformType.Windows),
            true,
        );
        assert.deepStrictEqual(stubs.windowsPlatformConstructorStub.firstCall.args, [
            { projectRoot: "project" },
            { packager },
        ]);
        assert.strictEqual(stubs.beforeStartPackagerStub.calledOnce, true);
        assert.strictEqual(stubs.startPackagerStub.calledOnce, true);
        assert.strictEqual(stubs.runAppStub.calledWithExactly(false), true);
        assert.strictEqual(
            stubs.beforeStartPackagerStub.calledBefore(stubs.startPackagerStub),
            true,
        );
        assert.strictEqual(stubs.startPackagerStub.calledBefore(stubs.runAppStub), true);
    });

    test("should prepare React Native versions and validate Windows support", async function () {
        const stubs = createCommandModule();
        const { project, nodeModulesRoot } = createMockProject();
        const command = stubs.RunWindows.formInstance() as any;
        command.project = project;

        await command.onBeforeExecute();

        assert.strictEqual(stubs.superOnBeforeExecuteStub.calledOnce, true);
        assert.strictEqual(
            stubs.setKnownDateForFeatureByIdStub.calledWithExactly("debuggingRNWAndMacOSApps"),
            true,
        );
        assert.strictEqual(
            stubs.checkTargetPlatformSupportStub.calledWithExactly(PlatformType.Windows),
            true,
        );
        assert.strictEqual(
            stubs.getVersionsStub.calledWithExactly(nodeModulesRoot, [reactNativeWindowsPackage]),
            true,
        );
        assert.deepStrictEqual(project.setReactNativeVersions.firstCall.args, [
            { reactNativeVersion: "1.0.0" },
        ]);
    });

    const platformFailureCases: Array<{
        name: string;
        failingStub: (stubs: ReturnType<typeof createCommandModule>) => Sinon.SinonStub;
        subsequentStubs: (stubs: ReturnType<typeof createCommandModule>) => Sinon.SinonStub[];
    }> = [
        {
            name: "packager preparation",
            failingStub: stubs => stubs.beforeStartPackagerStub,
            subsequentStubs: stubs => [stubs.startPackagerStub, stubs.runAppStub],
        },
        {
            name: "packager startup",
            failingStub: stubs => stubs.startPackagerStub,
            subsequentStubs: stubs => [stubs.runAppStub],
        },
        {
            name: "app launch",
            failingStub: stubs => stubs.runAppStub,
            subsequentStubs: () => [],
        },
    ];

    for (const failureCase of platformFailureCases) {
        test(`should stop the Windows flow when ${failureCase.name} fails`, async function () {
            const error = new Error(`failed during ${failureCase.name}`);
            const stubs = createCommandModule();
            const { project } = createMockProject();
            failureCase.failingStub(stubs).returns(Promise.reject(error));

            await assert.rejects(() => runCommand(stubs, project), error);

            for (const subsequentStub of failureCase.subsequentStubs(stubs)) {
                assert.strictEqual(subsequentStub.called, false);
            }
        });
    }
});
