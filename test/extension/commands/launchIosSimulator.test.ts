// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");
import { TargetType } from "../../../src/extension/generalPlatform";

suite("launchIOSSimulatorCommand", function () {
    function createCommandModule(
        collectTargetsStub = Sinon.stub().returns(Promise.resolve()),
        selectAndPrepareTargetStub = Sinon.stub().returns(Promise.resolve()),
    ) {
        const targetManagerConstructorStub = Sinon.stub();

        class FakeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        class FakeIOSTargetManager {
            public collectTargets = collectTargetsStub;
            public selectAndPrepareTarget = selectAndPrepareTargetStub;

            constructor() {
                targetManagerConstructorStub();
            }
        }

        const module = proxyquire.noCallThru()(
            "../../../src/extension/commands/launchIosSimulator",
            {
                "../ios/iOSTargetManager": {
                    IOSTargetManager: FakeIOSTargetManager,
                },
                "./util/command": {
                    Command: FakeCommand,
                },
            },
        ) as typeof import("../../../src/extension/commands/launchIosSimulator");

        return {
            LaunchIOSSimulator: module.LaunchIOSSimulator,
            targetManagerConstructorStub,
            collectTargetsStub,
            selectAndPrepareTargetStub,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/launchIosSimulator").LaunchIOSSimulator,
    ): Promise<void> {
        const command = commandClass.formInstance();
        await command.baseFn();
    }

    test("should create an iOS target manager and collect simulator targets", async function () {
        const {
            LaunchIOSSimulator,
            targetManagerConstructorStub,
            collectTargetsStub,
            selectAndPrepareTargetStub,
        } = createCommandModule();

        await runCommand(LaunchIOSSimulator);

        assert.strictEqual(targetManagerConstructorStub.calledOnce, true);
        assert.strictEqual(collectTargetsStub.calledWithExactly(TargetType.Simulator), true);
        assert.strictEqual(selectAndPrepareTargetStub.calledOnce, true);
        assert.strictEqual(collectTargetsStub.calledBefore(selectAndPrepareTargetStub), true);
    });

    test("should select only virtual iOS targets", async function () {
        const { LaunchIOSSimulator, selectAndPrepareTargetStub } = createCommandModule();

        await runCommand(LaunchIOSSimulator);

        const targetFilter = selectAndPrepareTargetStub.firstCall.args[0];
        assert.strictEqual(targetFilter({ isVirtualTarget: true }), true);
        assert.strictEqual(targetFilter({ isVirtualTarget: false }), false);
    });

    test("should propagate collection errors without starting target selection", async function () {
        const error = new Error("failed to collect iOS targets");
        const collectTargetsStub = Sinon.stub().returns(Promise.reject(error));
        const selectAndPrepareTargetStub = Sinon.stub().returns(Promise.resolve());
        const { LaunchIOSSimulator } = createCommandModule(
            collectTargetsStub,
            selectAndPrepareTargetStub,
        );

        await assert.rejects(() => runCommand(LaunchIOSSimulator), error);

        assert.strictEqual(selectAndPrepareTargetStub.called, false);
    });
});
