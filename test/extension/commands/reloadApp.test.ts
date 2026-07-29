// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("reloadAppCommand", function () {
    function createCommandModule(sendMessageToMetroStub: Sinon.SinonStub) {
        class FakeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/reloadApp", {
            "./util": {
                sendMessageToMetro: sendMessageToMetroStub,
            },
            "./util/command": {
                Command: FakeCommand,
            },
        }) as typeof import("../../../src/extension/commands/reloadApp");

        return module.ReloadApp;
    }

    test("should send the reload message to Metro for the current project", async function () {
        const sendMessageToMetroStub = Sinon.stub().returns(Promise.resolve());
        const ReloadApp = createCommandModule(sendMessageToMetroStub);
        const command = ReloadApp.formInstance();
        const project = {};
        (command as any).project = project;

        await command.baseFn();

        assert.strictEqual(sendMessageToMetroStub.calledWithExactly("reload", project), true);
    });

    test("should propagate errors from Metro", async function () {
        const error = new Error("Metro connection failed");
        const sendMessageToMetroStub = Sinon.stub().returns(Promise.reject(error));
        const ReloadApp = createCommandModule(sendMessageToMetroStub);
        const command = ReloadApp.formInstance();
        (command as any).project = {};

        await assert.rejects(() => command.baseFn(), error);
    });
});
