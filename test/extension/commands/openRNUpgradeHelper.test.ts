// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("openRNUpgradeHelperCommand", function () {
    const quickPickItems = ["React Native", "React Native Windows", "React Native MacOS"];
    const quickPickOptions = {
        placeHolder: "Select type for your react native project",
    };

    function createCommandModule(selection?: string) {
        const waitStub = Sinon.stub().returns(Promise.resolve());
        const showQuickPickStub = Sinon.stub().returns(Promise.resolve(selection));
        const parsedUri = {};
        const parseStub = Sinon.stub().returns(parsedUri);
        const openExternalStub = Sinon.stub().returns(Promise.resolve());
        const logger = {
            info: Sinon.stub(),
        };

        class FakeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()(
            "../../../src/extension/commands/openRNUpgradeHelper",
            {
                vscode: {
                    window: {
                        showQuickPick: showQuickPickStub,
                    },
                    env: {
                        openExternal: openExternalStub,
                    },
                    Uri: {
                        parse: parseStub,
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
                "./util/command": {
                    Command: FakeCommand,
                },
            },
        ) as typeof import("../../../src/extension/commands/openRNUpgradeHelper");

        return {
            OpenRNUpgradeHelper: module.OpenRNUpgradeHelper,
            waitStub,
            showQuickPickStub,
            parsedUri,
            parseStub,
            openExternalStub,
            logger,
        };
    }

    async function verifySelection(selection: string, expectedUrl: string): Promise<void> {
        const {
            OpenRNUpgradeHelper,
            waitStub,
            showQuickPickStub,
            parsedUri,
            parseStub,
            openExternalStub,
            logger,
        } = createCommandModule(selection);
        const command = OpenRNUpgradeHelper.formInstance();
        (command as any).project = {};

        await command.baseFn();

        assert.strictEqual(waitStub.calledOnce, true);
        assert.strictEqual(
            showQuickPickStub.calledWithExactly(quickPickItems, quickPickOptions),
            true,
        );
        assert.strictEqual(parseStub.calledWithExactly(expectedUrl), true);
        assert.strictEqual(openExternalStub.calledWithExactly(parsedUri), true);
        assert.strictEqual(logger.info.calledOnce, true);
    }

    test("should open the React Native upgrade helper", async function () {
        await verifySelection(
            "React Native",
            "https://react-native-community.github.io/upgrade-helper/?package=react-native",
        );
    });

    test("should open the React Native Windows upgrade helper", async function () {
        await verifySelection(
            "React Native Windows",
            "https://react-native-community.github.io/upgrade-helper/?package=react-native-windows&language=cpp",
        );
    });

    test("should open the React Native MacOS upgrade helper", async function () {
        await verifySelection(
            "React Native MacOS",
            "https://react-native-community.github.io/upgrade-helper/?package=react-native-macos",
        );
    });

    test("should not open an upgrade helper when selection is cancelled", async function () {
        const {
            OpenRNUpgradeHelper,
            waitStub,
            showQuickPickStub,
            parseStub,
            openExternalStub,
            logger,
        } = createCommandModule();
        const command = OpenRNUpgradeHelper.formInstance();
        (command as any).project = {};

        await command.baseFn();

        assert.strictEqual(waitStub.calledOnce, true);
        assert.strictEqual(
            showQuickPickStub.calledWithExactly(quickPickItems, quickPickOptions),
            true,
        );
        assert.strictEqual(parseStub.called, false);
        assert.strictEqual(openExternalStub.called, false);
        assert.strictEqual(logger.info.calledOnce, true);
    });
});
