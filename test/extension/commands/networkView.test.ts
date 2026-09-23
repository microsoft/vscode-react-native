// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("networkViewCommand", function () {
    function createCommandModule() {
        const logger = {
            info: Sinon.stub(),
        };
        const showQuickPickStub = Sinon.stub();
        const showInformationMessageStub = Sinon.stub().returns(Promise.resolve());
        const showErrorMessageStub = Sinon.stub().returns(Promise.resolve());
        const updateStub = Sinon.stub().returns(Promise.resolve());
        const getConfigurationStub = Sinon.stub().returns({ update: updateStub });
        const waitStub = Sinon.stub().returns(Promise.resolve());
        const globalConfigurationTarget = Symbol("Global");

        class FakeReactNativeCommand {
            public project: any;

            static formInstance(): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/networkView", {
            "vscode-nls": {
                config: () => () => undefined,
                MessageFormat: { bundle: "bundle" },
                BundleFormat: { standalone: "standalone" },
            },
            vscode: {
                ConfigurationTarget: {
                    Global: globalConfigurationTarget,
                },
                window: {
                    showQuickPick: showQuickPickStub,
                    showInformationMessage: showInformationMessageStub,
                    showErrorMessage: showErrorMessageStub,
                },
                workspace: {
                    getConfiguration: getConfigurationStub,
                },
            },
            "../../common/error/errorHelper": {
                ErrorHelper: {
                    getInternalError: () => new Error("toggle network view failed"),
                },
            },
            "../../common/error/internalErrorCode": {
                InternalErrorCode: {
                    FailedToToggleNetworkView: 0,
                },
            },
            "../../common/utils": {
                wait: waitStub,
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getMainChannel: () => logger,
                },
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/networkView");

        return {
            NetworkView: module.NetworkView,
            logger,
            showQuickPickStub,
            showInformationMessageStub,
            showErrorMessageStub,
            updateStub,
            getConfigurationStub,
            waitStub,
            globalConfigurationTarget,
        };
    }

    async function runCommand(stubs: ReturnType<typeof createCommandModule>): Promise<void> {
        const command = stubs.NetworkView.formInstance();
        (command as any).project = {};
        await command.baseFn();
    }

    test("should enable Network View", async function () {
        const stubs = createCommandModule();
        stubs.showQuickPickStub.returns(Promise.resolve("On"));

        await runCommand(stubs);

        assert.strictEqual(stubs.waitStub.calledOnce, true);
        assert.strictEqual(
            stubs.showQuickPickStub.calledWithExactly(["On", "Off"], {
                placeHolder: "Enable or disable Network View.",
            }),
            true,
        );
        assert.strictEqual(stubs.getConfigurationStub.calledWithExactly("debug.javascript"), true);
        assert.strictEqual(
            stubs.updateStub.calledWithExactly(
                "enableNetworkView",
                true,
                stubs.globalConfigurationTarget,
            ),
            true,
        );
        assert.strictEqual(
            stubs.showInformationMessageStub.calledWithExactly("Network View has been enabled."),
            true,
        );
        assert.strictEqual(
            stubs.logger.info.calledWithExactly(
                "Network View has been enabled. You can view info from debug tab.",
            ),
            true,
        );
    });

    test("should disable Network View", async function () {
        const stubs = createCommandModule();
        stubs.showQuickPickStub.returns(Promise.resolve("Off"));

        await runCommand(stubs);

        assert.strictEqual(
            stubs.updateStub.calledWithExactly(
                "enableNetworkView",
                false,
                stubs.globalConfigurationTarget,
            ),
            true,
        );
        assert.strictEqual(
            stubs.showInformationMessageStub.calledWithExactly("Network View has been disabled."),
            true,
        );
        assert.strictEqual(
            stubs.logger.info.calledWithExactly("Network View has been disabled."),
            true,
        );
    });

    test("should stop when the selection is cancelled", async function () {
        const stubs = createCommandModule();
        stubs.showQuickPickStub.returns(Promise.resolve(undefined));

        await runCommand(stubs);

        assert.strictEqual(stubs.getConfigurationStub.called, false);
        assert.strictEqual(stubs.updateStub.called, false);
        assert.strictEqual(stubs.showInformationMessageStub.called, false);
        assert.strictEqual(stubs.showErrorMessageStub.called, false);
        assert.strictEqual(stubs.logger.info.called, false);
    });

    test("should report a configuration update error", async function () {
        const error = new Error("configuration update failed");
        const stubs = createCommandModule();
        stubs.showQuickPickStub.returns(Promise.resolve("On"));
        stubs.updateStub.returns(Promise.reject(error));

        await runCommand(stubs);

        assert.strictEqual(
            stubs.showErrorMessageStub.calledWithExactly("Failed to enable Network View"),
            true,
        );
        assert.strictEqual(stubs.showInformationMessageStub.called, false);
        assert.strictEqual(
            stubs.logger.info.calledWithExactly(`Failed to enable Network View: ${String(error)}`),
            true,
        );
    });
});
