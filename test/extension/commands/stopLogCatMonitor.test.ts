// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");
import { InternalErrorCode } from "../../../src/common/error/internalErrorCode";

suite("stopLogCatMonitorCommand", function () {
    function createMonitor(deviceId: string): any {
        return {
            deviceId,
            dispose: Sinon.stub(),
        };
    }

    function createCommandModule(
        logCatMonitorsCache: { [key: string]: any },
        showQuickPickStub = Sinon.stub(),
        delMonitorStub = Sinon.stub(),
        logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
            warning: Sinon.stub(),
            debug: Sinon.stub(),
        },
    ) {
        const module = proxyquire.noCallThru()(
            "../../../src/extension/commands/stopLogCatMonitor",
            {
                vscode: {
                    window: {
                        showQuickPick: showQuickPickStub,
                    },
                },
                "../android/logCatMonitorManager": {
                    LogCatMonitorManager: {
                        logCatMonitorsCache,
                        delMonitor: delMonitorStub,
                    },
                },
                "../log/OutputChannelLogger": {
                    OutputChannelLogger: {
                        getMainChannel: () => logger,
                    },
                },
            },
        ) as typeof import("../../../src/extension/commands/stopLogCatMonitor");

        return {
            StopLogCatMonitor: module.StopLogCatMonitor,
            delMonitorStub,
            showQuickPickStub,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/stopLogCatMonitor").StopLogCatMonitor,
    ): Promise<void> {
        const command = commandClass.formInstance();
        await command.baseFn();
    }

    test("should throw when there are no active LogCat monitors", async function () {
        const { StopLogCatMonitor, delMonitorStub, showQuickPickStub } = createCommandModule({});

        await assert.rejects(
            () => runCommand(StopLogCatMonitor),
            (error: any) => {
                assert.strictEqual(
                    error.errorCode,
                    InternalErrorCode.AndroidCouldNotFindActiveLogCatMonitor,
                );
                return true;
            },
        );
        assert.strictEqual(showQuickPickStub.called, false);
        assert.strictEqual(delMonitorStub.called, false);
    });

    test("should delete the only active LogCat monitor without showing QuickPick", async function () {
        const { StopLogCatMonitor, delMonitorStub, showQuickPickStub } = createCommandModule({
            emulator: createMonitor("emulator"),
        });

        await runCommand(StopLogCatMonitor);

        assert.strictEqual(showQuickPickStub.called, false);
        assert.strictEqual(delMonitorStub.calledWithExactly("emulator"), true);
    });

    test("should delete the selected LogCat monitor", async function () {
        const showQuickPickStub = Sinon.stub().returns(Promise.resolve("device"));
        const { StopLogCatMonitor, delMonitorStub } = createCommandModule(
            {
                emulator: createMonitor("emulator"),
                device: createMonitor("device"),
            },
            showQuickPickStub,
        );

        await runCommand(StopLogCatMonitor);

        assert.strictEqual(showQuickPickStub.calledWithExactly(["emulator", "device"]), true);
        assert.strictEqual(delMonitorStub.calledWithExactly("device"), true);
    });

    test("should return without deleting a LogCat monitor when selection is cancelled", async function () {
        const showQuickPickStub = Sinon.stub().returns(Promise.resolve(undefined));
        const { StopLogCatMonitor, delMonitorStub } = createCommandModule(
            {
                emulator: createMonitor("emulator"),
                device: createMonitor("device"),
            },
            showQuickPickStub,
        );

        await runCommand(StopLogCatMonitor);

        assert.strictEqual(showQuickPickStub.calledWithExactly(["emulator", "device"]), true);
        assert.strictEqual(delMonitorStub.called, false);
    });
});
