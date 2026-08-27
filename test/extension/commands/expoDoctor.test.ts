// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("expoDoctorCommand", function () {
    const projectRootPath = "test-project";

    function createCommandModule(
        execStub: Sinon.SinonStub,
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
            public exec = execStub;
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

    function createExecResult(outcome: Promise<string>): any {
        return Promise.resolve({
            process: {},
            outcome,
        });
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
        const execStub = Sinon.stub().returns(createExecResult(Promise.resolve("No issues found")));
        const { expoDoctor, logger } = createCommandModule(execStub);

        await runCommand(expoDoctor);

        assert.strictEqual(
            execStub.calledWithExactly("npx expo-doctor", { cwd: projectRootPath }),
            true,
        );
        assert.strictEqual(logger.info.calledWithExactly("Running diagnostics..."), true);
        assert.strictEqual(logger.info.calledWithExactly("No issues found"), true);
    });

    test("should propagate an error when starting expo doctor fails", async function () {
        const error = new Error("could not start expo doctor");
        const execStub = Sinon.stub().returns(Promise.reject(error));
        const { expoDoctor, logger } = createCommandModule(execStub);

        await assert.rejects(() => runCommand(expoDoctor), error);
        assert.strictEqual(logger.info.called, false);
    });

    test("should propagate an error when expo doctor exits unsuccessfully", async function () {
        const error = new Error("expo doctor failed");
        const execStub = Sinon.stub().returns(createExecResult(Promise.reject(error)));
        const { expoDoctor, logger } = createCommandModule(execStub);

        await assert.rejects(() => runCommand(expoDoctor), error);
        assert.strictEqual(logger.info.calledWithExactly("Running diagnostics..."), true);
    });

    test("should require a project before running expo doctor", async function () {
        const execStub = Sinon.stub().returns(createExecResult(Promise.resolve("")));
        const { expoDoctor } = createCommandModule(execStub);
        const command = expoDoctor.formInstance();

        await assert.rejects(() => command.baseFn(), assert.AssertionError);
        assert.strictEqual(execStub.called, false);
    });
});
