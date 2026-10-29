// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { EventEmitter } from "events";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("expoDoctorCommand", function () {
    const projectRootPath = "test-project";

    function createCommandModule(
        spawnStub: Sinon.SinonStub,
        logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
        },
    ) {
        class FakeReactNativeCommand {
            public static formInstance(this: new () => any): any {
                return new this();
            }
        }

        class FakeChildProcess {
            public spawn = spawnStub;
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/expoDoctor", {
            "../../common/node/childProcess": {
                ChildProcess: FakeChildProcess,
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getMainChannel: () => logger,
                },
            },
            "../../common/error/errorHelper": {
                ErrorHelper: {
                    getInternalError: () => new Error("expo doctor failed"),
                },
            },
            "../../common/error/internalErrorCode": {
                InternalErrorCode: {
                    FailedToRunExpoDoctor: 0,
                },
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/expoDoctor");

        return {
            expoDoctor: module.expoDoctor,
            logger,
        };
    }

    function createSpawnResult(stdout: string, stderr: string, error?: Error): any {
        const stdoutStream = new EventEmitter();
        const stderrStream = new EventEmitter();
        const outcome = new Promise<void>((resolve, reject) => {
            setImmediate(() => {
                stdoutStream.emit("data", Buffer.from(stdout));
                stderrStream.emit("data", Buffer.from(stderr));
                error ? reject(error) : resolve();
            });
        });

        return {
            stdout: stdoutStream,
            stderr: stderrStream,
            outcome,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/expoDoctor").expoDoctor,
        projectPath: string = projectRootPath,
    ): Promise<void> {
        const command = commandClass.formInstance();
        (command as any).project = {
            getPackager: () => ({
                getProjectPath: () => projectPath,
            }),
        };
        await command.baseFn();
    }

    test("should run expo doctor from the project root and log the outcome", async function () {
        const spawnStub = Sinon.stub().returns(createSpawnResult("No issues found", ""));
        const { expoDoctor, logger } = createCommandModule(spawnStub);

        await runCommand(expoDoctor);

        assert.strictEqual(
            spawnStub.calledWithExactly("npx", ["expo-doctor"], { cwd: projectRootPath }),
            true,
        );
        assert.strictEqual(logger.info.calledWithExactly("Running diagnostics..."), true);
        assert.strictEqual(logger.info.calledWithExactly("No issues found"), true);
    });

    test("should propagate an error when starting expo doctor fails", async function () {
        const error = new Error("could not start expo doctor");
        const spawnStub = Sinon.stub().throws(error);
        const { expoDoctor, logger } = createCommandModule(spawnStub);

        await assert.rejects(() => runCommand(expoDoctor), error);
        assert.strictEqual(logger.info.called, false);
    });

    test("should log output and propagate an error when expo doctor exits unsuccessfully", async function () {
        const error = new Error("expo doctor failed");
        const spawnStub = Sinon.stub().returns(
            createSpawnResult("Issues found", "Dependency mismatch", error),
        );
        const { expoDoctor, logger } = createCommandModule(spawnStub);

        await assert.rejects(() => runCommand(expoDoctor), error);
        assert.strictEqual(logger.info.calledWithExactly("Running diagnostics..."), true);
        assert.strictEqual(logger.info.calledWithExactly("Issues found"), true);
        assert.strictEqual(logger.error.calledWithExactly("Dependency mismatch"), true);
    });

    test("should require a project before running expo doctor", async function () {
        const spawnStub = Sinon.stub().returns(createSpawnResult("", ""));
        const { expoDoctor } = createCommandModule(spawnStub);
        const command = expoDoctor.formInstance();

        await assert.rejects(() => command.baseFn(), assert.AssertionError);
        assert.strictEqual(spawnStub.called, false);
    });
});
