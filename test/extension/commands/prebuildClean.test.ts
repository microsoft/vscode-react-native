// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("prebuildCleanCommand", function () {
    function createMockProject(projectPath: string): any {
        return {
            getPackager: () => ({
                getProjectPath: () => projectPath,
            }),
        };
    }

    test("should run expo prebuild clean from the project root", async function () {
        const executeStub = Sinon.stub().returns(Promise.resolve());
        const getChannelStub = Sinon.stub().returns({
            info: Sinon.stub(),
            error: Sinon.stub(),
            warning: Sinon.stub(),
            debug: Sinon.stub(),
        });
        const getNodeModulesRootStub = Sinon.stub().returns("/workspace/app/node_modules");
        const constructorArgs: any[][] = [];

        class FakeCommandExecutor {
            constructor(...args: any[]) {
                constructorArgs.push(args);
            }

            public execute = executeStub;
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/prebuildClean", {
            "../../common/commandExecutor": {
                CommandExecutor: FakeCommandExecutor,
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
        }) as typeof import("../../../src/extension/commands/prebuildClean");

        const command = module.PrebuildClean.formInstance();
        (command as any).project = createMockProject("/workspace/app");

        await command.baseFn();

        assert.strictEqual(getChannelStub.calledWithExactly("Expo Prebuild Clean", true), true);
        assert.strictEqual(getNodeModulesRootStub.calledWithExactly("/workspace/app"), true);
        assert.deepStrictEqual(constructorArgs[0].slice(0, 2), [
            "/workspace/app/node_modules",
            "/workspace/app",
        ]);
        assert.strictEqual(executeStub.calledWithExactly("npx expo prebuild --clean"), true);
    });
});
