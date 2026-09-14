// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("networkViewCommand", function () {
    function createCommandModule(
        showQuickPickStub: Sinon.SinonStub,
        updateStub: Sinon.SinonStub,
        showInformationMessageStub = Sinon.stub().returns(Promise.resolve()),
        showErrorMessageStub = Sinon.stub().returns(Promise.resolve()),
        logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
            warning: Sinon.stub(),
            debug: Sinon.stub(),
        },
    ) {
        const getConfigurationStub = Sinon.stub().returns({
            update: updateStub,
        });

        class FakeReactNativeCommand {}

        const module = proxyquire.noCallThru()("../../../src/extension/commands/networkView", {
            vscode: {
                window: {
                    showQuickPick: showQuickPickStub,
                    showInformationMessage: showInformationMessageStub,
                    showErrorMessage: showErrorMessageStub,
                },
                workspace: {
                    getConfiguration: getConfigurationStub,
                },
                ConfigurationTarget: {
                    Global: "Global",
                },
            },
            "../../common/utils": {
                wait: () => Promise.resolve(),
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
            getConfigurationStub,
            showInformationMessageStub,
            showErrorMessageStub,
            logger,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/networkView").NetworkView,
    ): Promise<void> {
        const command = new commandClass();
        (command as any).project = {};
        await command.baseFn();
    }

    test("should enable Network View when On is selected", async function () {
        const showQuickPickStub = Sinon.stub().returns(Promise.resolve("On"));
        const updateStub = Sinon.stub().returns(Promise.resolve());
        const {
            NetworkView,
            getConfigurationStub,
            showInformationMessageStub,
            showErrorMessageStub,
            logger,
        } = createCommandModule(showQuickPickStub, updateStub);

        await runCommand(NetworkView);

        assert.strictEqual(
            showQuickPickStub.calledWithExactly(["On", "Off"], {
                placeHolder: "Enable or disable Network View.",
            }),
            true,
        );
        assert.strictEqual(getConfigurationStub.calledWithExactly("debug.javascript"), true);
        assert.strictEqual(
            updateStub.calledWithExactly("enableNetworkView", true, "Global"),
            true,
        );
        assert.strictEqual(
            showInformationMessageStub.calledWithExactly("Network View has been enabled."),
            true,
        );
        assert.strictEqual(
            logger.info.calledWithExactly(
                "Network View has been enabled. You can view info from debug tab.",
            ),
            true,
        );
        assert.strictEqual(showErrorMessageStub.called, false);
    });

    test("should disable Network View when Off is selected", async function () {
        const showQuickPickStub = Sinon.stub().returns(Promise.resolve("Off"));
        const updateStub = Sinon.stub().returns(Promise.resolve());
        const {
            NetworkView,
            getConfigurationStub,
            showInformationMessageStub,
            showErrorMessageStub,
            logger,
        } = createCommandModule(showQuickPickStub, updateStub);

        await runCommand(NetworkView);

        assert.strictEqual(getConfigurationStub.calledWithExactly("debug.javascript"), true);
        assert.strictEqual(
            updateStub.calledWithExactly("enableNetworkView", false, "Global"),
            true,
        );
        assert.strictEqual(
            showInformationMessageStub.calledWithExactly("Network View has been disabled."),
            true,
        );
        assert.strictEqual(
            logger.info.calledWithExactly("Network View has been disabled."),
            true,
        );
        assert.strictEqual(showErrorMessageStub.called, false);
    });

    test("should return without updating configuration when selection is cancelled", async function () {
        const showQuickPickStub = Sinon.stub().returns(Promise.resolve(undefined));
        const updateStub = Sinon.stub().returns(Promise.resolve());
        const {
            NetworkView,
            getConfigurationStub,
            showInformationMessageStub,
            showErrorMessageStub,
        } = createCommandModule(showQuickPickStub, updateStub);

        await runCommand(NetworkView);

        assert.strictEqual(getConfigurationStub.called, false);
        assert.strictEqual(updateStub.called, false);
        assert.strictEqual(showInformationMessageStub.called, false);
        assert.strictEqual(showErrorMessageStub.called, false);
    });

    test("should report configuration update errors", async function () {
        const showQuickPickStub = Sinon.stub().returns(Promise.resolve("On"));
        const error = new Error("Configuration update failed");
        const updateStub = Sinon.stub().returns(Promise.reject(error));
        const {
            NetworkView,
            showInformationMessageStub,
            showErrorMessageStub,
            logger,
        } = createCommandModule(showQuickPickStub, updateStub);

        await runCommand(NetworkView);

        assert.strictEqual(
            updateStub.calledWithExactly("enableNetworkView", true, "Global"),
            true,
        );
        assert.strictEqual(showInformationMessageStub.called, false);
        assert.strictEqual(
            showErrorMessageStub.calledWithExactly("Failed to enable Network View"),
            true,
        );
        assert.strictEqual(
            logger.info.calledWithExactly(
                "Failed to enable Network View: Error: Configuration update failed",
            ),
            true,
        );
    });
});
