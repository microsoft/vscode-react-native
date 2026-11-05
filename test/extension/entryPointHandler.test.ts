// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import { spawnSync } from "child_process";
import { EntryPointHandler, ProcessType } from "../../src/common/entryPointHandler";
import { InternalError, NestedError } from "../../src/common/error/internalError";
import { Telemetry } from "../../src/common/telemetry";

suite("EntryPointHandler", function () {
    const sandbox = Sinon.sandbox.create();
    let logger: {
        log: Sinon.SinonStub;
        info: Sinon.SinonStub;
        warning: Sinon.SinonStub;
        error: Sinon.SinonStub;
        debug: Sinon.SinonStub;
        logStream: Sinon.SinonStub;
    };
    let send: Sinon.SinonStub;
    let init: Sinon.SinonStub;
    const wrapperError = new InternalError(101, "entry point failed");

    setup(function () {
        logger = {
            log: sandbox.stub(),
            info: sandbox.stub(),
            warning: sandbox.stub(),
            error: sandbox.stub(),
            debug: sandbox.stub(),
            logStream: sandbox.stub(),
        };
        send = sandbox.stub(Telemetry, "send");
        init = sandbox.stub(Telemetry, "init");
    });

    teardown(function () {
        sandbox.restore();
    });

    test("waits for the callback before sending completion telemetry", async function () {
        const handler = new EntryPointHandler(ProcessType.Extension, logger);
        let finish: () => void;
        const callback = new Promise<void>(resolve => {
            finish = resolve;
        });
        const result = handler.runFunction("test-command", wrapperError, () => callback);
        assert.strictEqual(send.called, false);

        finish!();
        await result;

        assert.strictEqual(send.calledOnce, true);
        assert.strictEqual(send.firstCall.args[0].name, "test-command");
        assert.strictEqual(logger.error.called, false);
    });

    test("includes callback telemetry and explicit command properties", async function () {
        const handler = new EntryPointHandler(ProcessType.Extension, logger);
        await handler.runFunctionWExtProps(
            "test-command",
            { platform: { value: "android", isPii: false } },
            wrapperError,
            telemetry => {
                telemetry.add("callbackRan", "yes", false);
            },
        );

        assert.strictEqual(send.calledOnce, true);
        const event = send.firstCall.args[0];
        assert.strictEqual(event.properties.platform, "android");
        assert.strictEqual(event.properties.callbackRan, "yes");
        assert.strictEqual(logger.error.called, false);
    });

    for (const processType of [ProcessType.Extension, ProcessType.Debugger, ProcessType.Debugee]) {
        test(`preserves nonfatal rejection and logs its cause for ${ProcessType[processType]}`, async function () {
            const handler = new EntryPointHandler(processType, logger);
            const cause = new Error("command failed");

            await assert.rejects(
                handler.runFunction("test-command", wrapperError, async () => {
                    throw cause;
                }),
                (error: Error) => error === cause,
            );

            assert.strictEqual(logger.error.calledOnce, true);
            const [message, error, stack] = logger.error.firstCall.args;
            assert.strictEqual(message, wrapperError.message);
            assert.ok(error instanceof NestedError);
            assert.strictEqual(error.innerError, cause);
            assert.strictEqual(stack, true);
            assert.strictEqual(send.calledOnce, true);
        });
    }

    test("initializes application telemetry before executing the entry point", async function () {
        const handler = new EntryPointHandler(ProcessType.Extension, logger);
        const reporter = { sendTelemetryEvent: sandbox.stub() };
        let callbackRan = false;

        await handler.runApp(
            "test-app",
            "1.0.0",
            wrapperError,
            reporter,
            () => {
                assert.strictEqual(init.calledOnce, true);
                callbackRan = true;
            },
            { platform: { value: "ios", isPii: false } },
        );

        assert.strictEqual(callbackRan, true);
        assert.strictEqual(init.calledWithExactly("test-app", "1.0.0", reporter), true);
        assert.strictEqual(send.firstCall.args[0].properties.platform, "ios");
        assert.strictEqual(logger.error.called, false);
    });

    test("logs and rethrows synchronous application initialization failures", function () {
        const handler = new EntryPointHandler(ProcessType.Extension, logger);
        const cause = new Error("telemetry initialization failed");
        init.throws(cause);
        const callback = sandbox.stub();

        assert.throws(
            () =>
                handler.runApp(
                    "test-app",
                    "1.0.0",
                    wrapperError,
                    { sendTelemetryEvent: sandbox.stub() },
                    callback,
                ),
            (error: Error) => error === cause,
        );

        assert.strictEqual(logger.error.calledWithExactly(cause.message, cause), true);
        assert.strictEqual(callback.called, false);
    });

    for (const processType of ["Extension", "Debugger", "Debugee"]) {
        test(`handles fatal errors in an isolated ${processType} process`, function () {
            const script = `
                const { EntryPointHandler, ProcessType } = require(process.argv[1]);
                const { InternalError } = require(process.argv[2]);
                const { Telemetry } = require(process.argv[3]);
                Telemetry.send = () => {};
                const logger = { error(message, error, stack) {
                    console.log(JSON.stringify({ message, cause: error.innerError.message, stack }));
                } };
                new EntryPointHandler(ProcessType[process.argv[4]], logger)
                    .runFunction('fatal-command', new InternalError(101, 'entry point failed'),
                        async () => { throw new Error('original failure'); }, true)
                    .catch(() => {});
            `;
            const child = spawnSync(
                process.execPath,
                [
                    "-e",
                    script,
                    require.resolve("../../src/common/entryPointHandler"),
                    require.resolve("../../src/common/error/internalError"),
                    require.resolve("../../src/common/telemetry"),
                    processType,
                ],
                {
                    encoding: "utf8",
                    timeout: 10000,
                    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
                },
            );

            assert.ifError(child.error);
            assert.strictEqual(child.status, 1, child.stderr);
            const logged = JSON.parse(child.stdout.trim());
            assert.strictEqual(logged.cause, "original failure");
            assert.strictEqual(logged.stack, processType === "Debugee");
            if (processType !== "Debugee") {
                assert.ok(child.stderr.includes("original failure"));
            }
        });
    }
});
