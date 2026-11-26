// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as sinon from "sinon";
import { EntryPointHandler, ProcessType } from "../../src/common/entryPointHandler";
import { InternalError, NestedError } from "../../src/common/error/internalError";
import { InternalErrorCode } from "../../src/common/error/internalErrorCode";
import { Telemetry } from "../../src/common/telemetry";
import { TelemetryGenerator } from "../../src/common/telemetryGenerators";
import { TelemetryHelper } from "../../src/common/telemetryHelper";
import { ConsoleLogger } from "../../src/extension/log/ConsoleLogger";

suite("EntryPointHandler", function () {
    const taskName = "entryPointTest";
    const entryPointError = new InternalError(
        InternalErrorCode.CommandFailed,
        "Entry point failed",
    );
    let handler: EntryPointHandler;
    let sendTelemetryStub: Sinon.SinonStub;
    let logErrorStub: Sinon.SinonStub;
    let initTelemetryStub: Sinon.SinonStub;
    let stubs: Sinon.SinonStub[];

    setup(function () {
        stubs = [];
        const logger = new ConsoleLogger();
        logErrorStub = sinon.stub(logger, "error");
        sendTelemetryStub = sinon.stub(Telemetry, "send");
        initTelemetryStub = sinon.stub(Telemetry, "init");
        stubs.push(logErrorStub, sendTelemetryStub, initTelemetryStub);
        handler = new EntryPointHandler(ProcessType.Extension, logger);
    });

    teardown(function () {
        stubs.forEach(stub => stub.restore());
    });

    function getTelemetryEvent(): Telemetry.TelemetryEvent {
        sinon.assert.calledOnce(sendTelemetryStub);
        const event: Telemetry.TelemetryEvent = sendTelemetryStub.firstCall.args[0];
        assert.strictEqual(event.name, taskName);
        assert.strictEqual(event.properties.step, "initialStep");
        assert.strictEqual(event.properties.lastStepExecuted, "initialStep");
        const duration = Number(event.properties["initialStep.time"]);
        assert.ok(Number.isFinite(duration) && duration >= 0);
        return event;
    }

    test("executes a synchronous function and records its telemetry", async function () {
        const codeToRun = sinon.spy((telemetry: TelemetryGenerator) => {
            assert.ok(telemetry instanceof TelemetryGenerator);
            telemetry.add("result", "success", false);
        });

        await handler.runFunction(taskName, entryPointError, codeToRun);

        sinon.assert.calledOnce(codeToRun);
        assert.strictEqual(getTelemetryEvent().properties.result, "success");
        sinon.assert.notCalled(logErrorStub);
    });

    test("waits for an asynchronous function before sending telemetry", async function () {
        let complete: () => void = () => assert.fail("Callback was not executed");
        let completed = false;
        const pending = new Promise<void>(resolve => {
            complete = resolve;
        });
        const result = handler.runFunction(taskName, entryPointError, async telemetry => {
            await pending;
            completed = true;
            telemetry.add("result", "async success", false);
        });

        sinon.assert.notCalled(sendTelemetryStub);
        complete();
        await result;

        assert.strictEqual(completed, true);
        assert.strictEqual(getTelemetryEvent().properties.result, "async success");
        sinon.assert.notCalled(logErrorStub);
    });

    for (const asynchronous of [false, true]) {
        for (const internal of [false, true]) {
            test(`reports ${internal ? "internal" : "ordinary"} errors from ${
                asynchronous ? "asynchronous" : "synchronous"
            } functions and preserves the rejection`, async function () {
                const reason = internal
                    ? new InternalError(InternalErrorCode.PackagerStartFailed, "Task failed")
                    : new Error("Task failed");
                const result = handler.runFunction(taskName, entryPointError, () => {
                    if (asynchronous) {
                        return Promise.reject(reason);
                    }
                    throw reason;
                });

                await assert.rejects(result, (error: unknown) => error === reason);

                const event = getTelemetryEvent();
                assert.strictEqual(
                    event.properties["error.code0"],
                    String(
                        internal
                            ? InternalErrorCode.PackagerStartFailed
                            : InternalErrorCode.UnknownError,
                    ),
                );
                sinon.assert.calledOnce(logErrorStub);
                const [message, wrappedError, logStack] = logErrorStub.firstCall.args;
                assert.strictEqual(message, entryPointError.message);
                assert.ok(wrappedError instanceof NestedError);
                assert.strictEqual(wrappedError.innerError, reason);
                assert.strictEqual(
                    wrappedError.errorCode,
                    internal ? InternalErrorCode.PackagerStartFailed : entryPointError.errorCode,
                );
                assert.strictEqual(logStack, true);
            });
        }
    }

    for (const processType of [ProcessType.Extension, ProcessType.Debugee, ProcessType.Debugger]) {
        test(`forwards telemetry properties for the ${ProcessType[processType]} process`, async function () {
            const processHandler = new EntryPointHandler(processType);
            const extProps = {
                processType: TelemetryHelper.telemetryProperty(ProcessType[processType]),
            };

            await processHandler.runFunction(taskName, entryPointError, () => {}, false, extProps);

            assert.strictEqual(
                getTelemetryEvent().properties.processType,
                ProcessType[processType],
            );
            assert.deepStrictEqual(extProps, {
                processType: {
                    value: ProcessType[processType],
                    isPii: false,
                },
            });
        });
    }

    test("runFunctionWExtProps records extended and callback telemetry properties", async function () {
        await handler.runFunctionWExtProps(
            taskName,
            { platform: TelemetryHelper.telemetryProperty("android") },
            entryPointError,
            telemetry => {
                telemetry.add("result", "success", false);
            },
        );

        const event = getTelemetryEvent();
        assert.strictEqual(event.properties.platform, "android");
        assert.strictEqual(event.properties.result, "success");
        sinon.assert.notCalled(logErrorStub);
    });

    test("exits with code 1 and logs the stack for a fatal debugee error", async function () {
        const logger = new ConsoleLogger();
        const debugeeLogStub = sinon.stub(logger, "error");
        const exitStub = sinon.stub(process, "exit");
        stubs.push(debugeeLogStub, exitStub);
        const debugeeHandler = new EntryPointHandler(ProcessType.Debugee, logger);
        const reason = new Error("Fatal error");

        await assert.rejects(
            debugeeHandler.runFunction(
                taskName,
                entryPointError,
                () => Promise.reject(reason),
                true,
            ),
            (error: unknown) => error === reason,
        );

        sinon.assert.calledOnce(exitStub);
        sinon.assert.calledWithExactly(exitStub, 1);
        sinon.assert.calledOnce(debugeeLogStub);
        assert.strictEqual(debugeeLogStub.firstCall.args[2], true);
        assert.strictEqual(
            getTelemetryEvent().properties["error.code0"],
            String(InternalErrorCode.UnknownError),
        );
    });

    suite("runApp", function () {
        const reporter: Telemetry.ITelemetryReporter = {
            sendTelemetryEvent: () => assert.fail("Real telemetry must not be sent"),
        };

        test("initializes telemetry before executing the application", async function () {
            await handler.runApp(
                taskName,
                "1.0.0",
                entryPointError,
                reporter,
                async () => {
                    sinon.assert.calledWithExactly(initTelemetryStub, taskName, "1.0.0", reporter);
                    await Promise.resolve();
                },
                { platform: TelemetryHelper.telemetryProperty("ios") },
            );

            sinon.assert.calledOnce(initTelemetryStub);
            assert.strictEqual(getTelemetryEvent().properties.platform, "ios");
            sinon.assert.notCalled(logErrorStub);
        });

        test("treats application errors as fatal and returns the wrapped promise", async function () {
            const result = Promise.resolve();
            const runFunctionStub = sinon.stub(handler, "runFunction").returns(result);
            stubs.push(runFunctionStub);
            const codeToRun = () => {};
            const extProps = { platform: TelemetryHelper.telemetryProperty("android") };

            const appResult = handler.runApp(
                taskName,
                "1.0.0",
                entryPointError,
                reporter,
                codeToRun,
                extProps,
            );

            assert.strictEqual(appResult, result);
            await appResult;
            sinon.assert.calledOnce(runFunctionStub);
            sinon.assert.calledWithExactly(
                runFunctionStub,
                taskName,
                entryPointError,
                codeToRun,
                true,
                extProps,
            );
        });

        for (const reason of [new Error("Initialization failed"), 42]) {
            test(`logs and rethrows initialization failures thrown as ${
                reason instanceof Error ? "an Error" : "a non-Error value"
            }`, function () {
                initTelemetryStub.throws(reason);
                const codeToRun = sinon.spy();

                assert.throws(
                    () => handler.runApp(taskName, "1.0.0", entryPointError, reporter, codeToRun),
                    (error: unknown) => error === reason,
                );

                sinon.assert.calledWithExactly(
                    logErrorStub,
                    reason instanceof Error ? reason.message : String(reason),
                    reason instanceof Error ? reason : undefined,
                );
                sinon.assert.notCalled(codeToRun);
                sinon.assert.notCalled(sendTelemetryStub);
            });
        }
    });
});
