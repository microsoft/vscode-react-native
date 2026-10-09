// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("startLogCatMonitorCommand", function () {
    function createMockProject(
        projectPath: string,
        nodeModulesRoot: string,
        workspaceUri: any,
    ): any {
        return {
            getPackager: () => ({
                getProjectPath: () => projectPath,
            }),
            getOrUpdateNodeModulesRoot: () => nodeModulesRoot,
            getWorkspaceFolderUri: () => workspaceUri,
        };
    }

    function createCommandModule(
        selectedTarget: any,
        startStub = Sinon.stub().returns(Promise.resolve()),
    ) {
        const selectAndPrepareTargetStub = Sinon.stub().returns(Promise.resolve(selectedTarget));
        const delMonitorStub = Sinon.stub();
        const addMonitorStub = Sinon.stub();
        const showErrorMessageStub = Sinon.stub();
        const getLogCatFilteringArgsStub = Sinon.stub().returns(["*:S", "ReactNative:V"]);
        const setKnownDateForFeatureByIdStub = Sinon.stub().returns(Promise.resolve());
        const adbHelperConstructorStub = Sinon.stub();
        const logCatMonitorConstructorStub = Sinon.stub();
        const logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
            warning: Sinon.stub(),
            debug: Sinon.stub(),
        };

        class FakeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        class FakeAdbHelper {
            constructor(projectPath: string, nodeModulesRoot: string) {
                adbHelperConstructorStub(projectPath, nodeModulesRoot);
            }
        }

        class FakeAndroidTargetManager {
            constructor(adbHelper: FakeAdbHelper) {
                assert.ok(adbHelper instanceof FakeAdbHelper);
            }

            async selectAndPrepareTarget(filter: (target: any) => boolean): Promise<any> {
                if (selectedTarget) {
                    assert.strictEqual(filter(selectedTarget), selectedTarget.isOnline);
                }
                return selectAndPrepareTargetStub(filter);
            }
        }

        class FakeLogCatMonitor {
            public deviceId: string;
            public start = startStub;

            constructor(deviceId: string, adbHelper: FakeAdbHelper, logCatArguments: string[]) {
                assert.ok(adbHelper instanceof FakeAdbHelper);
                this.deviceId = deviceId;
                logCatMonitorConstructorStub(deviceId, adbHelper, logCatArguments);
            }
        }

        const module = proxyquire.noCallThru()(
            "../../../src/extension/commands/startLogCatMonitor",
            {
                vscode: {
                    window: {
                        showErrorMessage: showErrorMessageStub,
                    },
                },
                "../android/adb": {
                    AdbHelper: FakeAdbHelper,
                },
                "../android/androidTargetManager": {
                    AndroidTargetManager: FakeAndroidTargetManager,
                },
                "../android/logCatMonitor": {
                    LogCatMonitor: FakeLogCatMonitor,
                },
                "../android/logCatMonitorManager": {
                    LogCatMonitorManager: {
                        delMonitor: delMonitorStub,
                        addMonitor: addMonitorStub,
                    },
                },
                "../services/tipsNotificationsService/tipsNotificationService": {
                    TipNotificationService: {
                        getInstance: () => ({
                            setKnownDateForFeatureById: setKnownDateForFeatureByIdStub,
                        }),
                    },
                },
                "../settingsHelper": {
                    SettingsHelper: {
                        getLogCatFilteringArgs: getLogCatFilteringArgsStub,
                    },
                },
                "../log/OutputChannelLogger": {
                    OutputChannelLogger: {
                        getMainChannel: () => logger,
                    },
                },
                "./util/command": {
                    Command: FakeCommand,
                },
            },
        ) as typeof import("../../../src/extension/commands/startLogCatMonitor");

        return {
            StartLogCatMonitor: module.StartLogCatMonitor,
            adbHelperConstructorStub,
            selectAndPrepareTargetStub,
            delMonitorStub,
            addMonitorStub,
            showErrorMessageStub,
            getLogCatFilteringArgsStub,
            setKnownDateForFeatureByIdStub,
            logCatMonitorConstructorStub,
            logger,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/startLogCatMonitor").StartLogCatMonitor,
        projectPath = "testProject",
        nodeModulesRoot = "testProject/node_modules",
        workspaceUri = { fsPath: projectPath },
    ): Promise<void> {
        const command = commandClass.formInstance();
        (command as any).project = createMockProject(projectPath, nodeModulesRoot, workspaceUri);
        await command.baseFn();
    }

    test("should show an error and not start a monitor when no online target is selected", async function () {
        const { StartLogCatMonitor, delMonitorStub, addMonitorStub, showErrorMessageStub } =
            createCommandModule(undefined);

        await runCommand(StartLogCatMonitor);

        assert.strictEqual(showErrorMessageStub.calledOnce, true);
        assert.strictEqual(delMonitorStub.called, false);
        assert.strictEqual(addMonitorStub.called, false);
    });

    test("should replace the previous monitor and start a new LogCat monitor", async function () {
        const target = {
            id: "emulator-5554",
            isOnline: true,
        };
        const startStub = Sinon.stub().returns(Promise.resolve());
        const { StartLogCatMonitor, delMonitorStub, addMonitorStub, logCatMonitorConstructorStub } =
            createCommandModule(target, startStub);

        await runCommand(StartLogCatMonitor);

        assert.strictEqual(delMonitorStub.calledWithExactly(target.id), true);
        assert.strictEqual(addMonitorStub.calledOnce, true);
        assert.strictEqual(startStub.calledOnce, true);
        assert.strictEqual(delMonitorStub.calledBefore(addMonitorStub), true);
        assert.strictEqual(logCatMonitorConstructorStub.firstCall.args[0], target.id);
    });

    test("should pass project paths and configured LogCat arguments to dependencies", async function () {
        const target = {
            id: "device",
            isOnline: true,
        };
        const projectPath = "testProject";
        const nodeModulesRoot = "testProject/node_modules";
        const workspaceUri = { fsPath: projectPath };
        const {
            StartLogCatMonitor,
            adbHelperConstructorStub,
            getLogCatFilteringArgsStub,
            logCatMonitorConstructorStub,
            setKnownDateForFeatureByIdStub,
        } = createCommandModule(target);

        await runCommand(StartLogCatMonitor, projectPath, nodeModulesRoot, workspaceUri);

        assert.strictEqual(setKnownDateForFeatureByIdStub.calledWithExactly("logCatMonitor"), true);
        assert.strictEqual(
            adbHelperConstructorStub.calledWithExactly(projectPath, nodeModulesRoot),
            true,
        );
        assert.strictEqual(getLogCatFilteringArgsStub.calledWithExactly(workspaceUri), true);
        assert.deepStrictEqual(logCatMonitorConstructorStub.firstCall.args[2], [
            "*:S",
            "ReactNative:V",
        ]);
    });

    test("should log a warning when LogCat monitoring fails", async function () {
        const target = {
            id: "device",
            isOnline: true,
        };
        const startStub = Sinon.stub().returns(Promise.reject(new Error("logcat failed")));
        const { StartLogCatMonitor, logger } = createCommandModule(target, startStub);

        await runCommand(StartLogCatMonitor);
        await Promise.resolve();

        assert.strictEqual(logger.warning.calledOnce, true);
    });
});
