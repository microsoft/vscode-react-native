// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");
import { TargetType } from "../../../src/extension/generalPlatform";

suite("launchAndroidSimulatorCommand", function () {
    function createMockProject(projectPath: string, nodeModulesRoot: string): any {
        return {
            getPackager: () => ({
                getProjectPath: () => projectPath,
            }),
            getOrUpdateNodeModulesRoot: () => nodeModulesRoot,
        };
    }

    function createCommandModule(
        collectTargetsStub = Sinon.stub().returns(Promise.resolve()),
        selectAndPrepareTargetStub = Sinon.stub().returns(Promise.resolve()),
    ) {
        const adbHelperConstructorStub = Sinon.stub();
        const targetManagerConstructorStub = Sinon.stub();

        class FakeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        class FakeAdbHelper {
            constructor(projectPath: string, nodeModulesRoot: string) {
                adbHelperConstructorStub(projectPath, nodeModulesRoot);
            }
        }

        class FakeAndroidTargetManager {
            public collectTargets = collectTargetsStub;
            public selectAndPrepareTarget = selectAndPrepareTargetStub;

            constructor(adbHelper: FakeAdbHelper) {
                assert.ok(adbHelper instanceof FakeAdbHelper);
                targetManagerConstructorStub(adbHelper);
            }
        }

        const module = proxyquire.noCallThru()(
            "../../../src/extension/commands/launchAndroidEmulator",
            {
                "../android/adb": {
                    AdbHelper: FakeAdbHelper,
                },
                "../android/androidTargetManager": {
                    AndroidTargetManager: FakeAndroidTargetManager,
                },
                "./util/command": {
                    Command: FakeCommand,
                },
            },
        ) as typeof import("../../../src/extension/commands/launchAndroidEmulator");

        return {
            LaunchAndroidSimulator: module.LaunchAndroidSimulator,
            adbHelperConstructorStub,
            targetManagerConstructorStub,
            collectTargetsStub,
            selectAndPrepareTargetStub,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/launchAndroidEmulator").LaunchAndroidSimulator,
        projectPath = "testProject",
        nodeModulesRoot = "testProject/node_modules",
    ): Promise<void> {
        const command = commandClass.formInstance();
        (command as any).project = createMockProject(projectPath, nodeModulesRoot);
        await command.baseFn();
    }

    test("should create Android dependencies and collect simulator targets", async function () {
        const projectPath = "project";
        const nodeModulesRoot = "project/node_modules";
        const {
            LaunchAndroidSimulator,
            adbHelperConstructorStub,
            targetManagerConstructorStub,
            collectTargetsStub,
            selectAndPrepareTargetStub,
        } = createCommandModule();

        await runCommand(LaunchAndroidSimulator, projectPath, nodeModulesRoot);

        assert.strictEqual(
            adbHelperConstructorStub.calledWithExactly(projectPath, nodeModulesRoot),
            true,
        );
        assert.strictEqual(targetManagerConstructorStub.calledOnce, true);
        assert.strictEqual(collectTargetsStub.calledWithExactly(TargetType.Simulator), true);
        assert.strictEqual(selectAndPrepareTargetStub.calledOnce, true);
        assert.strictEqual(collectTargetsStub.calledBefore(selectAndPrepareTargetStub), true);
    });

    test("should select only virtual Android targets", async function () {
        const { LaunchAndroidSimulator, selectAndPrepareTargetStub } = createCommandModule();

        await runCommand(LaunchAndroidSimulator);

        const targetFilter = selectAndPrepareTargetStub.firstCall.args[0];
        assert.strictEqual(targetFilter({ isVirtualTarget: true }), true);
        assert.strictEqual(targetFilter({ isVirtualTarget: false }), false);
    });

    test("should propagate collection errors without starting target selection", async function () {
        const error = new Error("failed to collect targets");
        const collectTargetsStub = Sinon.stub().returns(Promise.reject(error));
        const selectAndPrepareTargetStub = Sinon.stub().returns(Promise.resolve());
        const { LaunchAndroidSimulator } = createCommandModule(
            collectTargetsStub,
            selectAndPrepareTargetStub,
        );

        await assert.rejects(() => runCommand(LaunchAndroidSimulator), error);

        assert.strictEqual(selectAndPrepareTargetStub.called, false);
    });
});
