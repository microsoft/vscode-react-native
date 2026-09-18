// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("rnDoctorCommand", function () {
    const projectRootPath = "test-project";
    const nodeModulesRoot = "test-node-modules";
    const failedToRunDoctorErrorCode = 126;

    function createCommandModule() {
        const commandError = new Error("React Native doctor failed");
        const logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
            warning: Sinon.stub(),
            debug: Sinon.stub(),
        };
        const spawnResult = { process: {} };
        const spawnReactCommandStub = Sinon.stub().returns(spawnResult);
        const commandExecutorConstructorStub = Sinon.stub();
        const outputVerifierConstructorStub = Sinon.stub();
        const processStub = Sinon.stub().returns(Promise.resolve());
        const getChannelStub = Sinon.stub().returns(logger);
        const getNodeModulesRootStub = Sinon.stub().returns(nodeModulesRoot);
        const getInternalErrorStub = Sinon.stub().returns(commandError);

        class FakeReactNativeCommand {
            public project: any;

            static formInstance(): any {
                return new this();
            }
        }

        class FakeCommandExecutor {
            constructor(...args: any[]) {
                commandExecutorConstructorStub(...args);
            }

            public spawnReactCommand = spawnReactCommandStub;
        }

        class FakeOutputVerifier {
            constructor(...args: any[]) {
                outputVerifierConstructorStub(...args);
            }

            public process = processStub;
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/rnDoctor", {
            "../../common/commandExecutor": {
                CommandExecutor: FakeCommandExecutor,
            },
            "../../common/error/errorHelper": {
                ErrorHelper: {
                    getInternalError: getInternalErrorStub,
                },
            },
            "../../common/error/internalErrorCode": {
                InternalErrorCode: {
                    FailedToRunRNDoctor: failedToRunDoctorErrorCode,
                },
            },
            "../../common/outputVerifier": {
                OutputVerifier: FakeOutputVerifier,
            },
            "../appLauncher": {
                AppLauncher: {
                    getNodeModulesRootByProjectPath: getNodeModulesRootStub,
                },
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getChannel: getChannelStub,
                },
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/rnDoctor");

        const project = {
            getPackager: Sinon.stub().returns({
                getProjectPath: Sinon.stub().returns(projectRootPath),
            }),
        };

        return {
            rnDoctor: module.rnDoctor,
            project,
            commandError,
            logger,
            spawnResult,
            spawnReactCommandStub,
            commandExecutorConstructorStub,
            outputVerifierConstructorStub,
            processStub,
            getChannelStub,
            getNodeModulesRootStub,
            getInternalErrorStub,
        };
    }

    async function runCommand(stubs: ReturnType<typeof createCommandModule>): Promise<any> {
        const command = stubs.rnDoctor.formInstance();
        (command as any).project = stubs.project;
        await command.baseFn();
        return command;
    }

    test("should expose the registered command metadata", async function () {
        const stubs = createCommandModule();

        const command = await runCommand(stubs);

        assert.strictEqual(command.codeName, "doctor");
        assert.strictEqual(command.label, "React Native Doctor");
        assert.strictEqual(command.error, stubs.commandError);
        assert.strictEqual(
            stubs.getInternalErrorStub.calledWithExactly(failedToRunDoctorErrorCode),
            true,
        );
    });

    test("should execute React Native doctor from the project root", async function () {
        const stubs = createCommandModule();

        await runCommand(stubs);

        assert.strictEqual(stubs.getNodeModulesRootStub.calledWithExactly(projectRootPath), true);
        assert.strictEqual(
            stubs.getChannelStub.calledWithExactly("ReactNativeRunDoctor", true),
            true,
        );
        assert.strictEqual(
            stubs.commandExecutorConstructorStub.calledWithExactly(
                nodeModulesRoot,
                projectRootPath,
                stubs.logger,
            ),
            true,
        );
        assert.strictEqual(stubs.spawnReactCommandStub.calledWithExactly("doctor"), true);
        assert.strictEqual(stubs.processStub.calledWithExactly(stubs.spawnResult), true);
    });

    test("should configure doctor output verification patterns", async function () {
        const stubs = createCommandModule();

        await runCommand(stubs);

        assert.strictEqual(stubs.outputVerifierConstructorStub.calledOnce, true);
        const [generateSuccessPatterns, generateFailurePatterns, operationName] =
            stubs.outputVerifierConstructorStub.firstCall.args;

        assert.strictEqual(operationName, "run doctor");
        assert.deepStrictEqual(await generateSuccessPatterns(), ["run doctor succeeded"]);
        assert.deepStrictEqual(await generateFailurePatterns(), [
            {
                pattern: "Failed to run doctor",
                errorCode: failedToRunDoctorErrorCode,
            },
        ]);
    });

    test("should propagate output verification errors", async function () {
        const error = new Error("doctor output verification failed");
        const stubs = createCommandModule();
        stubs.processStub.returns(Promise.reject(error));

        await assert.rejects(() => runCommand(stubs), error);
    });

    test("should require a project before running React Native doctor", async function () {
        const stubs = createCommandModule();
        const command = stubs.rnDoctor.formInstance();

        await assert.rejects(() => command.baseFn(), assert.AssertionError);

        assert.strictEqual(stubs.getChannelStub.called, false);
        assert.strictEqual(stubs.spawnReactCommandStub.called, false);
        assert.strictEqual(stubs.processStub.called, false);
    });
});
