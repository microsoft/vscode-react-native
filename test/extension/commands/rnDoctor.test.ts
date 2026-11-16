// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as path from "path";
import * as vscode from "vscode";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("rnDoctorCommand", function () {
    function createCommandModule(suffix = ".cmd") {
        const projectRoot = path.resolve("test project");
        const nodeModulesRoot = path.resolve("shared dependencies");
        const cli = path.resolve("custom cli folder", "react-native");
        const workspaceFolder = { name: "test workspace" };
        const commandError = new Error("Doctor failed");
        const getInternalError = Sinon.stub().returns(commandError);
        const getNodeModulesRoot = Sinon.stub().returns(nodeModulesRoot);
        const executorConstructor = Sinon.stub();
        const selectCLI = Sinon.stub().returns(cli);
        const getNpmCliCommand = Sinon.stub().returns(`${cli}${suffix}`);
        const shellConstructor = Sinon.stub();
        const taskConstructor = Sinon.stub();
        const executeTask = Sinon.stub().returns(Promise.resolve());
        const processDispose = Sinon.stub();
        const taskDispose = Sinon.stub();
        let processHandler: (event: vscode.TaskProcessEndEvent) => void;
        let taskHandler: (event: vscode.TaskEndEvent) => void;

        class FakeCommand {
            static formInstance(): any {
                return new this();
            }
        }
        class FakeExecutor {
            constructor(...args: unknown[]) {
                executorConstructor(...args);
            }
            selectReactNativeCLI = selectCLI;
        }
        class FakeTask {
            constructor(public definition: vscode.TaskDefinition, ...args: unknown[]) {
                taskConstructor(definition, ...args);
            }
        }
        class FakeShellExecution {
            constructor(...args: unknown[]) {
                shellConstructor(...args);
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/rnDoctor", {
            vscode: {
                Task: FakeTask,
                ShellExecution: FakeShellExecution,
                TaskRevealKind: { Always: 1 },
                TaskPanelKind: { Dedicated: 2 },
                tasks: {
                    executeTask,
                    onDidEndTaskProcess: (handler: typeof processHandler) => {
                        processHandler = handler;
                        return { dispose: processDispose };
                    },
                    onDidEndTask: (handler: typeof taskHandler) => {
                        taskHandler = handler;
                        return { dispose: taskDispose };
                    },
                },
            },
            "../../common/commandExecutor": { CommandExecutor: FakeExecutor },
            "../../common/hostPlatform": { HostPlatform: { getNpmCliCommand } },
            "../../common/error/errorHelper": { ErrorHelper: { getInternalError } },
            "../../common/error/internalErrorCode": {
                InternalErrorCode: { FailedToRunRNDoctor: 126, CommandFailed: 101 },
            },
            "../appLauncher": {
                AppLauncher: { getNodeModulesRootByProjectPath: getNodeModulesRoot },
            },
            "./util/reactNativeCommand": { ReactNativeCommand: FakeCommand },
        }) as typeof import("../../../src/extension/commands/rnDoctor");
        const command = module.rnDoctor.formInstance();
        (command as any).project = {
            getPackager: () => ({ getProjectPath: () => projectRoot }),
            getWorkspaceFolder: () => workspaceFolder,
        };
        // VS Code can serialize tasks, so events need not contain the original Task object.
        const execution = (own: boolean) => ({
            task: { definition: own ? { ...executeTask.firstCall.args[0].definition } : {} },
        });
        return {
            command,
            commandError,
            projectRoot,
            nodeModulesRoot,
            cli,
            workspaceFolder,
            getInternalError,
            getNodeModulesRoot,
            executorConstructor,
            getNpmCliCommand,
            shellConstructor,
            taskConstructor,
            executeTask,
            processDispose,
            taskDispose,
            endProcess: (exitCode?: number, own = true) =>
                processHandler({
                    execution: execution(own),
                    exitCode,
                } as vscode.TaskProcessEndEvent),
            endTask: (own = true) =>
                taskHandler({ execution: execution(own) } as vscode.TaskEndEvent),
        };
    }

    for (const suffix of [".cmd", ""]) {
        test(`should focus an interactive task using the selected CLI (${
            suffix || "Unix"
        })`, async function () {
            const s = createCommandModule(suffix);
            const result = s.command.baseFn();
            assert.strictEqual(s.command.codeName, "doctor");
            assert.strictEqual(s.command.label, "React Native Doctor");
            assert.strictEqual(s.getNodeModulesRoot.calledWithExactly(s.projectRoot), true);
            assert.strictEqual(
                s.executorConstructor.calledWithExactly(s.nodeModulesRoot, s.projectRoot),
                true,
            );
            assert.strictEqual(s.getNpmCliCommand.calledWithExactly(s.cli), true);
            assert.deepStrictEqual(s.shellConstructor.firstCall.args, [
                `${s.cli}${suffix}`,
                ["doctor"],
                { cwd: s.projectRoot },
            ]);
            assert.strictEqual(s.taskConstructor.firstCall.args[1], s.workspaceFolder);
            assert.strictEqual(s.taskConstructor.firstCall.args[2], "React Native Doctor");
            assert.deepStrictEqual(s.executeTask.firstCall.args[0].presentationOptions, {
                reveal: 1,
                focus: true,
                panel: 2,
            });
            s.endProcess(0);
            await result;
            assert.strictEqual(s.processDispose.calledOnce, true);
            assert.strictEqual(s.taskDispose.calledOnce, true);
        });
    }

    test("should wait for Doctor and ignore unrelated task events", async function () {
        const s = createCommandModule();
        let completed = false;
        const result = s.command.baseFn().then(() => {
            completed = true;
        });
        s.endProcess(1, false);
        s.endTask(false);
        await Promise.resolve();
        assert.strictEqual(completed, false);
        s.endProcess(0);
        s.endTask();
        await result;
    });

    for (const exitCode of [1, undefined]) {
        test(`should report unsuccessful termination (${String(exitCode)})`, async function () {
            const s = createCommandModule();
            const result = s.command.baseFn();
            const rejection = assert.rejects(() => result, s.commandError);
            s.endProcess(exitCode);
            await rejection;
            assert.strictEqual(
                s.getInternalError.calledWithExactly(101, `${s.cli}.cmd doctor`, exitCode),
                true,
            );
            assert.strictEqual(s.processDispose.calledOnce, true);
            assert.strictEqual(s.taskDispose.calledOnce, true);
        });
    }

    test("should handle task termination without a process result", async function () {
        const s = createCommandModule();
        const result = s.command.baseFn();
        const rejection = assert.rejects(() => result, s.commandError);
        s.endTask();
        await rejection;
        assert.strictEqual(s.processDispose.calledOnce, true);
        assert.strictEqual(s.taskDispose.calledOnce, true);
    });

    test("should propagate startup failures and dispose listeners", async function () {
        const s = createCommandModule();
        const error = new Error("Cannot start task");
        s.executeTask.returns(Promise.reject(error));
        await assert.rejects(() => s.command.baseFn(), error);
        assert.strictEqual(s.processDispose.calledOnce, true);
        assert.strictEqual(s.taskDispose.calledOnce, true);
    });

    test("should require a project", async function () {
        const s = createCommandModule();
        (s.command as any).project = undefined;
        await assert.rejects(() => s.command.baseFn(), assert.AssertionError);
        assert.strictEqual(s.executeTask.called, false);
    });
});
