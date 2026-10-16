// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("networkInspectorCommands", function () {
    const fakeManager = {
        isRunning: Sinon.stub().returns(false),
        start: Sinon.stub().returns(Promise.resolve()),
        stop: Sinon.stub().returns(Promise.resolve()),
    };

    const loggerInfoStub = Sinon.stub();

    class FakeCommand {
        static formInstance(): any {
            return new this();
        }
    }

    class FakeNetworkInspectorManager {
        public isRunning = fakeManager.isRunning;
        public start = fakeManager.start;
        public stop = fakeManager.stop;
    }

    const commandModule = proxyquire.noCallThru()(
        "../../../src/extension/commands/networkInspector",
        {
            "vscode-nls": {
                config: () => () => (key: string, defaultValue: string) => defaultValue,
                loadMessageBundle: () => (_key: string, defaultValue: string) => defaultValue,
                MessageFormat: { bundle: "bundle" },
                BundleFormat: { standalone: "standalone" },
            },
            "../../common/error/errorHelper": {
                ErrorHelper: {
                    getInternalError: () => new Error("command failed"),
                },
            },
            "../../common/error/internalErrorCode": {
                InternalErrorCode: {
                    CouldNotStartNetworkInspector: 0,
                    CouldNotStopNetworkInspector: 1,
                },
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getMainChannel: () => ({ info: loggerInfoStub }),
                },
            },
            "./util/command": {
                Command: FakeCommand,
            },
            "./networkInspectorManager": {
                NetworkInspectorManager: FakeNetworkInspectorManager,
            },
        },
    ) as typeof import("../../../src/extension/commands/networkInspector");

    const { StartNetworkInspector, StopNetworkInspector } = commandModule;

    beforeEach(function () {
        fakeManager.isRunning.reset();
        fakeManager.start.reset();
        fakeManager.stop.reset();
        loggerInfoStub.reset();
    });

    suite("StartNetworkInspector", function () {
        test("should start inspector when not already running", async function () {
            fakeManager.isRunning.returns(false);
            const command = StartNetworkInspector.formInstance();
            (command as any).project = {};

            await command.baseFn();

            assert.strictEqual(fakeManager.isRunning.calledOnce, true);
            assert.strictEqual(fakeManager.start.calledOnce, true);
            assert.strictEqual(fakeManager.start.calledWith((command as any).project), true);
        });

        test("should log warning and skip start when inspector is already running", async function () {
            fakeManager.isRunning.returns(true);
            const command = StartNetworkInspector.formInstance();
            (command as any).project = {};

            await command.baseFn();

            assert.strictEqual(fakeManager.isRunning.calledOnce, true);
            assert.strictEqual(fakeManager.start.called, false);
            assert.strictEqual(loggerInfoStub.calledOnce, true);
            assert.strictEqual(
                loggerInfoStub.calledWith("Another Network inspector is already running"),
                true,
            );
        });

        test("should throw when project is not set", async function () {
            const command = StartNetworkInspector.formInstance();

            await assert.rejects(() => command.baseFn());
        });

        test("should propagate error from start", async function () {
            const error = new Error("start failed");
            fakeManager.isRunning.returns(false);
            fakeManager.start.returns(Promise.reject(error));
            const command = StartNetworkInspector.formInstance();
            (command as any).project = {};

            await assert.rejects(() => command.baseFn(), error);
        });
    });

    suite("StopNetworkInspector", function () {
        test("should call stop on the manager", async function () {
            const command = StopNetworkInspector.formInstance();

            await command.baseFn();

            assert.strictEqual(fakeManager.stop.calledOnce, true);
        });

        test("should propagate error from stop", async function () {
            const error = new Error("stop failed");
            fakeManager.stop.returns(Promise.reject(error));
            const command = StopNetworkInspector.formInstance();

            await assert.rejects(() => command.baseFn(), error);
        });
    });
});
