// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as vscode from "vscode";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("killPortCommand", function () {
    let showInputBoxStub: Sinon.SinonStub | undefined;
    let showErrorMessageStub: Sinon.SinonStub | undefined;

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
        if (showErrorMessageStub) {
            showErrorMessageStub.restore();
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

    test("should do nothing when port input is canceled", async function () {
        showInputBoxStub = Sinon.stub(vscode.window, "showInputBox").returns(
            Promise.resolve(undefined),
        );
        const execStub = Sinon.stub().returns(createExecResult(""));
        const { KillPort } = createCommandModule(execStub);
        const command = KillPort.formInstance();
        (command as any).project = {};

        await command.baseFn();

        assert.strictEqual(execStub.called, false);
    });

    test("should reject non-numeric and out-of-range port input", async function () {
        for (const value of ["abc", "0", "65536", "8081 8082", "8081;echo invalid"]) {
            showInputBoxStub = Sinon.stub(vscode.window, "showInputBox").returns(
                Promise.resolve(value),
            );
            showErrorMessageStub = Sinon.stub(vscode.window, "showErrorMessage");
            const execStub = Sinon.stub().returns(createExecResult(""));
            const { KillPort } = createCommandModule(execStub);
            const command = KillPort.formInstance();
            (command as any).project = {};

            await command.baseFn();

            assert.strictEqual(execStub.called, false, `Should reject input: ${value}`);
            assert.strictEqual(showErrorMessageStub.calledOnce, true);
            showInputBoxStub.restore();
            showErrorMessageStub.restore();
            showInputBoxStub = undefined;
            showErrorMessageStub = undefined;
        }
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

    test("should accept TCP port boundaries and normalize leading zeroes", async function () {
        for (const [input, expectedPort] of [
            ["1", "1"],
            ["65535", "65535"],
            ["008081", "8081"],
        ]) {
            showInputBoxStub = Sinon.stub(vscode.window, "showInputBox").returns(
                Promise.resolve(input),
            );
            const execStub = Sinon.stub().returns(createExecResult("killed"));
            const { KillPort } = createCommandModule(execStub);
            const command = KillPort.formInstance();
            (command as any).project = {};

            await command.baseFn();

            assert.strictEqual(execStub.calledWithExactly(`npx kill-port ${expectedPort}`), true);
            showInputBoxStub.restore();
            showInputBoxStub = undefined;
        }
    });
});
