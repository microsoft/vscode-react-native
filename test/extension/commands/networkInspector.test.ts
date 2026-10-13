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

        class FakeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        class FakeNetworkInspectorManager {
            public isRunning = isRunningStub;
            public start = startStub;
            public stop = stopStub;
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
                NetworkInspectorManager: FakeNetworkInspectorManager,
            },
        }) as typeof import("../../../src/extension/commands/networkInspector");

        return {
            StartNetworkInspector: module.StartNetworkInspector,
            StopNetworkInspector: module.StopNetworkInspector,
            isRunningStub,
            startStub,
            stopStub,
            loggerInfoStub,
        };
    }

    suite("StartNetworkInspector", function () {
        test("should start inspector when not already running", async function () {
            const { StartNetworkInspector, isRunningStub, startStub } = createCommandModule(
                Sinon.stub().returns(false),
            );
            const command = StartNetworkInspector.formInstance();
            (command as any).project = {};

            await command.baseFn();

            assert.strictEqual(isRunningStub.calledOnce, true);
            assert.strictEqual(startStub.calledOnce, true);
            assert.strictEqual(startStub.calledWith((command as any).project), true);
        });

        test("should log warning and skip start when inspector is already running", async function () {
            const { StartNetworkInspector, isRunningStub, startStub, loggerInfoStub } =
                createCommandModule(Sinon.stub().returns(true));
            const command = StartNetworkInspector.formInstance();
            (command as any).project = {};

            await command.baseFn();

            assert.strictEqual(isRunningStub.calledOnce, true);
            assert.strictEqual(startStub.called, false);
            assert.strictEqual(loggerInfoStub.calledOnce, true);
            assert.strictEqual(
                loggerInfoStub.calledWith("Another Network inspector is already running"),
                true,
            );
        });

        test("should propagate error from start", async function () {
            const error = new Error("start failed");
            const { StartNetworkInspector } = createCommandModule(
                Sinon.stub().returns(false),
                Sinon.stub().returns(Promise.reject(error)),
            );
            const command = StartNetworkInspector.formInstance();
            (command as any).project = {};

            await assert.rejects(() => command.baseFn(), error);
        });
    });

    suite("StopNetworkInspector", function () {
        test("should call stop on the manager", async function () {
            const { StopNetworkInspector, stopStub } = createCommandModule();
            const command = StopNetworkInspector.formInstance();

            await command.baseFn();

            assert.strictEqual(stopStub.calledOnce, true);
        });

        test("should propagate error from stop", async function () {
            const error = new Error("stop failed");
            const { StopNetworkInspector } = createCommandModule(
                Sinon.stub().returns(false),
                Sinon.stub().returns(Promise.resolve()),
                Sinon.stub().returns(Promise.reject(error)),
            );
            const command = StopNetworkInspector.formInstance();

            await assert.rejects(() => command.baseFn(), error);
        });
    });
});
