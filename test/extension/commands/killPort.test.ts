// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as vscode from "vscode";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("killPortCommand", function () {
    let showInputBoxStub: Sinon.SinonStub;

    function createCommandModule(
        execStub: Sinon.SinonStub,
        logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
            warning: Sinon.stub(),
            debug: Sinon.stub(),
        },
    ) {
        class FakeChildProcess {
            public exec = execStub;
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/killPort", {
            "../../common/node/childProcess": {
                ChildProcess: FakeChildProcess,
            },
            "../../common/utils": {
                wait: () => Promise.resolve(),
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getMainChannel: () => logger,
                },
            },
        }) as typeof import("../../../src/extension/commands/killPort");

        return {
            KillPort: module.killPort,
            logger,
        };
    }

    function createExecResult(outcome: string): any {
        return Promise.resolve({
            process: {},
            outcome: Promise.resolve(outcome),
        });
    }

    teardown(function () {
        if (showInputBoxStub) {
            showInputBoxStub.restore();
        }
    });

    test("should do nothing when port input is empty", async function () {
        showInputBoxStub = Sinon.stub(vscode.window, "showInputBox").returns(Promise.resolve(""));
        const execStub = Sinon.stub().returns(createExecResult(""));
        const { KillPort } = createCommandModule(execStub);
        const command = KillPort.formInstance();
        (command as any).project = {};

        await command.baseFn();

        assert.strictEqual(execStub.called, false);
    });

    test("should kill the selected port", async function () {
        showInputBoxStub = Sinon.stub(vscode.window, "showInputBox").returns(
            Promise.resolve("8081"),
        );
        const execStub = Sinon.stub().returns(createExecResult("killed"));
        const { KillPort, logger } = createCommandModule(execStub);
        const command = KillPort.formInstance();
        (command as any).project = {};

        await command.baseFn();

        assert.strictEqual(execStub.calledWithExactly("npx kill-port 8081"), true);
        assert.strictEqual(
            logger.info.args.some((args: string[]) => args[0].includes("killing port 8081")),
            true,
        );
        assert.strictEqual(logger.info.calledWithExactly("killed"), true);
    });
});
