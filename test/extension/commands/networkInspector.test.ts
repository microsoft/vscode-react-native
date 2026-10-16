// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import { NetworkInspectorManager } from "../../../src/extension/commands/networkInspectorManager";

suite("networkInspectorCommands", function () {
    let isRunningStub: Sinon.SinonStub;
    let startStub: Sinon.SinonStub;
    let stopStub: Sinon.SinonStub;
    let sandbox: Sinon.SinonSandbox;

    let StartNetworkInspector: typeof import("../../../src/extension/commands/networkInspector").StartNetworkInspector;
    let StopNetworkInspector: typeof import("../../../src/extension/commands/networkInspector").StopNetworkInspector;

    before(function () {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require("../../../src/extension/commands/networkInspector");
        StartNetworkInspector = mod.StartNetworkInspector;
        StopNetworkInspector = mod.StopNetworkInspector;
    });

    beforeEach(function () {
        sandbox = Sinon.sandbox.create();
        isRunningStub = sandbox.stub(NetworkInspectorManager.prototype, "isRunning").returns(false);
        startStub = sandbox
            .stub(NetworkInspectorManager.prototype, "start")
            .returns(Promise.resolve());
        stopStub = sandbox
            .stub(NetworkInspectorManager.prototype, "stop")
            .returns(Promise.resolve());
    });

    afterEach(function () {
        sandbox.restore();
    });

    suite("StartNetworkInspector", function () {
        test("should start inspector when not already running", async function () {
            isRunningStub.returns(false);
            const command = StartNetworkInspector.formInstance();
            (command as any).project = {};

            await command.baseFn();

            assert.strictEqual(isRunningStub.calledOnce, true);
            assert.strictEqual(startStub.calledOnce, true);
            assert.strictEqual(startStub.calledWith((command as any).project), true);
        });

        test("should log warning and skip start when inspector is already running", async function () {
            isRunningStub.returns(true);
            const command = StartNetworkInspector.formInstance();
            (command as any).project = {};

            await command.baseFn();

            assert.strictEqual(isRunningStub.calledOnce, true);
            assert.strictEqual(startStub.called, false);
        });

        test("should throw when project is not set", async function () {
            const command = StartNetworkInspector.formInstance();
            (command as any).project = undefined;

            await assert.rejects(() => command.baseFn());
        });

        test("should propagate error from start", async function () {
            const error = new Error("start failed");
            isRunningStub.returns(false);
            startStub.returns(Promise.reject(error));
            const command = StartNetworkInspector.formInstance();
            (command as any).project = {};

            await assert.rejects(() => command.baseFn(), error);
        });
    });

    suite("StopNetworkInspector", function () {
        test("should call stop on the manager", async function () {
            const command = StopNetworkInspector.formInstance();

            await command.baseFn();

            assert.strictEqual(stopStub.calledOnce, true);
        });

        test("should propagate error from stop", async function () {
            const error = new Error("stop failed");
            stopStub.returns(Promise.reject(error));
            const command = StopNetworkInspector.formInstance();

            await assert.rejects(() => command.baseFn(), error);
        });
    });
});
