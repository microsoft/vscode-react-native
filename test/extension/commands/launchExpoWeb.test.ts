// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");
import { PlatformType } from "../../../src/extension/launchArgs";

suite("launchExpoWebCommand", function () {
    function createCommandModule(isExpo: boolean) {
        const isExpoManagedAppStub = Sinon.stub().returns(Promise.resolve(isExpo));
        const packager = { name: "packager" };
        const getPackagerStub = Sinon.stub().returns(packager);
        const runOptions = { platform: PlatformType.ExpoWeb };
        const getRunOptionsStub = Sinon.stub().returns(runOptions);
        const platformConstructorStub = Sinon.stub();
        const beforeStartPackagerStub = Sinon.stub().returns(Promise.resolve());
        const startPackagerStub = Sinon.stub().returns(Promise.resolve());

        class FakeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        class FakeExponentPlatform {
            public beforeStartPackager = beforeStartPackagerStub;
            public startPackager = startPackagerStub;

            constructor(receivedRunOptions: any, options: any) {
                platformConstructorStub(receivedRunOptions, options);
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/launchExpoWeb", {
            "vscode-nls": {
                loadMessageBundle: () => (_key: string, message: string) => message,
            },
            "../exponent/exponentPlatform": {
                ExponentPlatform: FakeExponentPlatform,
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getMainChannel: () => ({ info: Sinon.stub() }),
                },
            },
            "./util": {
                getRunOptions: getRunOptionsStub,
            },
            "./util/command": {
                Command: FakeCommand,
            },
        }) as typeof import("../../../src/extension/commands/launchExpoWeb");

        const project = {
            getExponentHelper: () => ({ isExpoManagedApp: isExpoManagedAppStub }),
            getPackager: getPackagerStub,
        };

        return {
            launchExpoWeb: module.launchExpoWeb,
            project,
            packager,
            runOptions,
            isExpoManagedAppStub,
            getPackagerStub,
            getRunOptionsStub,
            platformConstructorStub,
            beforeStartPackagerStub,
            startPackagerStub,
        };
    }

    test("should return without starting a platform for non-Expo projects", async function () {
        const {
            launchExpoWeb,
            project,
            isExpoManagedAppStub,
            getPackagerStub,
            getRunOptionsStub,
            platformConstructorStub,
        } = createCommandModule(false);
        const command = launchExpoWeb.formInstance();
        (command as any).project = project;

        await command.baseFn({});

        assert.strictEqual(isExpoManagedAppStub.calledWithExactly(true), true);
        assert.strictEqual(getRunOptionsStub.called, false);
        assert.strictEqual(getPackagerStub.called, false);
        assert.strictEqual(platformConstructorStub.called, false);
    });

    test("should prepare and start Expo Web with project run options", async function () {
        const {
            launchExpoWeb,
            project,
            packager,
            runOptions,
            isExpoManagedAppStub,
            getPackagerStub,
            getRunOptionsStub,
            platformConstructorStub,
            beforeStartPackagerStub,
            startPackagerStub,
        } = createCommandModule(true);
        const command = launchExpoWeb.formInstance();
        (command as any).project = project;

        await command.baseFn({});

        assert.strictEqual(isExpoManagedAppStub.calledWithExactly(true), true);
        assert.strictEqual(
            getRunOptionsStub.calledWithExactly(project, PlatformType.ExpoWeb),
            true,
        );
        assert.strictEqual(getPackagerStub.calledOnce, true);
        assert.deepStrictEqual(platformConstructorStub.firstCall.args, [runOptions, { packager }]);
        assert.strictEqual(beforeStartPackagerStub.calledOnce, true);
        assert.strictEqual(startPackagerStub.calledOnce, true);
        assert.strictEqual(beforeStartPackagerStub.calledBefore(startPackagerStub), true);
    });
});
