// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("openExpoUpgradeHelperCommand", function () {
    const expoUpgradeUrl = "https://docs.expo.dev/bare/upgrade";

    function createCommandModule(openExternalStub = Sinon.stub().returns(Promise.resolve())) {
        const parsedUri = {};
        const parseStub = Sinon.stub().returns(parsedUri);
        const logger = { info: Sinon.stub() };

        class FakeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()(
            "../../../src/extension/commands/openExpoUpgradeHelper",
            {
                vscode: {
                    env: { openExternal: openExternalStub },
                    Uri: { parse: parseStub },
                },
                "../log/OutputChannelLogger": {
                    OutputChannelLogger: {
                        getMainChannel: () => logger,
                    },
                },
                "./util/command": { Command: FakeCommand },
            },
        ) as typeof import("../../../src/extension/commands/openExpoUpgradeHelper");

        return {
            openExpoUpgradeHelper: module.openExpoUpgradeHelper,
            parsedUri,
            parseStub,
            openExternalStub,
            logger,
        };
    }

    test("should expose the registered command metadata", function () {
        const { openExpoUpgradeHelper } = createCommandModule();
        const command = openExpoUpgradeHelper.formInstance();

        assert.strictEqual(command.codeName, "openExpoUpgradeHelper");
        assert.strictEqual(command.label, "Open expo upgrade helper in web page");
    });

    test("should open the Expo upgrade helper", async function () {
        const { openExpoUpgradeHelper, parsedUri, parseStub, openExternalStub, logger } =
            createCommandModule();
        const command = openExpoUpgradeHelper.formInstance();
        (command as any).project = {};

        await command.baseFn();

        assert.strictEqual(parseStub.calledWithExactly(expoUpgradeUrl), true);
        assert.strictEqual(openExternalStub.calledWithExactly(parsedUri), true);
        assert.strictEqual(
            logger.info.calledWithExactly("Open expo upgrade helper in web browser."),
            true,
        );
    });

    test("should propagate errors from opening the Expo upgrade helper", async function () {
        const error = new Error("failed to open URL");
        const openExternalStub = Sinon.stub().returns(Promise.reject(error));
        const { openExpoUpgradeHelper } = createCommandModule(openExternalStub);
        const command = openExpoUpgradeHelper.formInstance();
        (command as any).project = {};

        await assert.rejects(() => command.baseFn(), error);
    });

    test("should require a project before opening the Expo upgrade helper", async function () {
        const { openExpoUpgradeHelper, parseStub, openExternalStub, logger } =
            createCommandModule();
        const command = openExpoUpgradeHelper.formInstance();

        await assert.rejects(() => command.baseFn(), assert.AssertionError);

        assert.strictEqual(parseStub.called, false);
        assert.strictEqual(openExternalStub.called, false);
        assert.strictEqual(logger.info.called, false);
    });
});
