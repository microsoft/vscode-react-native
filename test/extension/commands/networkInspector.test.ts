// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("networkInspectorCommands", function () {
    function createCommandModule(
        isRunningStub = Sinon.stub().returns(false),
        startStub = Sinon.stub().returns(Promise.resolve()),
        stopStub = Sinon.stub().returns(Promise.resolve()),
    ) {
        const loggerInfoStub = Sinon.stub();

        const fakeManager = {
            isRunning: isRunningStub,
            start: startStub,
            stop: stopStub,
        };

        class FakeCommand {
            protected constructor() {}

            static formInstance(): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/networkInspector", {
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
                NetworkInspectorManager: function () {
                    return fakeManager;
                },
            },
        }) as typeof import("../../../src/extension/commands/networkInspector");

        const startCommand = new (module.StartNetworkInspector as any)(fakeManager);
        const stopCommand = new (module.StopNetworkInspector as any)(fakeManager);

        return {
            startCommand,
            stopCommand,
            isRunningStub,
            startStub,
            stopStub,
            loggerInfoStub,
        };
    }

    suite("StartNetworkInspector", function () {
        test("should start inspector when not already running", async function () {
            const { startCommand, isRunningStub, startStub } = createCommandModule(
                Sinon.stub().returns(false),
            );
            (startCommand as any).project = {};

            await startCommand.baseFn();

            assert.strictEqual(isRunningStub.calledOnce, true);
            assert.strictEqual(startStub.calledOnce, true);
            assert.strictEqual(startStub.calledWith((startCommand as any).project), true);
        });

        test("should log warning and skip start when inspector is already running", async function () {
            const { startCommand, isRunningStub, startStub, loggerInfoStub } = createCommandModule(
                Sinon.stub().returns(true),
            );
            (startCommand as any).project = {};

            await startCommand.baseFn();

            assert.strictEqual(isRunningStub.calledOnce, true);
            assert.strictEqual(startStub.called, false);
            assert.strictEqual(loggerInfoStub.calledOnce, true);
            assert.strictEqual(
                loggerInfoStub.calledWith("Another Network inspector is already running"),
                true,
            );
        });

        test("should throw when project is not set", async function () {
            const { startCommand } = createCommandModule();

            await assert.rejects(() => startCommand.baseFn());
        });

        test("should propagate error from start", async function () {
            const error = new Error("start failed");
            const { startCommand } = createCommandModule(
                Sinon.stub().returns(false),
                Sinon.stub().returns(Promise.reject(error)),
            );
            (startCommand as any).project = {};

            await assert.rejects(() => startCommand.baseFn(), error);
        });
    });

    suite("StopNetworkInspector", function () {
        test("should call stop on the manager", async function () {
            const { stopCommand, stopStub } = createCommandModule();

            await stopCommand.baseFn();

            assert.strictEqual(stopStub.calledOnce, true);
        });

        test("should propagate error from stop", async function () {
            const error = new Error("stop failed");
            const { stopCommand } = createCommandModule(
                Sinon.stub().returns(false),
                Sinon.stub().returns(Promise.resolve()),
                Sinon.stub().returns(Promise.reject(error)),
            );

            await assert.rejects(() => stopCommand.baseFn(), error);
        });
    });
});
