// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as sinon from "sinon";
import proxyquire = require("proxyquire");

suite("startStopCommands", function () {
    const fakeProject = {
        getPackager: () => ({
            getProjectPath: () => "/workspace/project",
        }),
    };

    const createCommandModule = (isRunning: boolean = false) => {
        const fakeManager = {
            isRunning: sinon.stub().returns(isRunning),
            start: sinon.stub().returns(Promise.resolve()),
            stop: sinon.stub().returns(Promise.resolve()),
        };
        const logger = {
            info: sinon.stub(),
        };

        function FakeNetworkInspectorManager() {
            return fakeManager;
        }

        class FakeCommand {
            static formInstance() {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/networkInspector", {
            "./util/command": {
                Command: FakeCommand,
            },
            "./networkInspectorManager": {
                NetworkInspectorManager: FakeNetworkInspectorManager,
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getMainChannel: sinon.stub().returns(logger),
                },
            },
        }) as typeof import("../../../src/extension/commands/networkInspector");

        return {
            StartNetworkInspector: module.StartNetworkInspector,
            StopNetworkInspector: module.StopNetworkInspector,
            fakeManager,
            logger,
        };
    };

    test("should start the Network Inspector when it is not running", async () => {
        const { StartNetworkInspector, fakeManager, logger } = createCommandModule();
        const command = StartNetworkInspector.formInstance();
        (command as any).project = fakeProject;

        await command.baseFn();

        assert.strictEqual(fakeManager.isRunning.calledOnce, true);
        assert.strictEqual(fakeManager.start.calledOnce, true);
        assert.strictEqual(fakeManager.start.firstCall.args[0], fakeProject);
        assert.strictEqual(logger.info.called, false);
    });

    test("should log and return early when the Network Inspector is already running", async () => {
        const { StartNetworkInspector, fakeManager, logger } = createCommandModule(true);
        const command = StartNetworkInspector.formInstance();
        (command as any).project = fakeProject;

        await command.baseFn();

        assert.strictEqual(fakeManager.isRunning.calledOnce, true);
        assert.strictEqual(fakeManager.start.called, false);
        assert.strictEqual(logger.info.calledOnce, true);
        assert.strictEqual(
            logger.info.firstCall.args[0],
            "Another Network inspector is already running",
        );
    });

    test("should stop the Network Inspector", async () => {
        const { StopNetworkInspector, fakeManager } = createCommandModule();
        const command = StopNetworkInspector.formInstance();

        await command.baseFn();

        assert.strictEqual(fakeManager.stop.calledOnce, true);
    });
});
