// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as path from "path";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("startPackagerCommand", function () {
    function createMockProject(
        projectPath: string,
        isRunningStub: Sinon.SinonStub,
        stopStub: Sinon.SinonStub,
        startStub: Sinon.SinonStub,
    ): any {
        return {
            getOrUpdateNodeModulesRoot: () => path.join(projectPath, "node_modules"),
            getPackager: () => ({
                isRunning: isRunningStub,
                stop: stopStub,
                start: startStub,
            }),
        };
    }

    function createCommandModule() {
        const getReactNativePackageVersionsStub = Sinon.stub().returns(Promise.resolve({}));

        class FakeReactNativeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/startPackager", {
            "../../common/projectVersionHelper": {
                ProjectVersionHelper: {
                    getReactNativePackageVersionsFromNodeModules: getReactNativePackageVersionsStub,
                },
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/startPackager");

        return {
            StartPackager: module.StartPackager,
            getReactNativePackageVersionsStub,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/startPackager").StartPackager,
        projectPath: string,
        isRunningStub: Sinon.SinonStub,
        stopStub: Sinon.SinonStub,
        startStub: Sinon.SinonStub,
    ): Promise<void> {
        const command = commandClass.formInstance();
        (command as any).project = createMockProject(
            projectPath,
            isRunningStub,
            stopStub,
            startStub,
        );
        await command.baseFn();
    }

    test("should start packager when it is not running", async function () {
        const projectPath = path.join("test", "project");
        const isRunningStub = Sinon.stub().returns(Promise.resolve(false));
        const stopStub = Sinon.stub().returns(Promise.resolve());
        const startStub = Sinon.stub().returns(Promise.resolve());
        const { StartPackager, getReactNativePackageVersionsStub } = createCommandModule();

        await runCommand(StartPackager, projectPath, isRunningStub, stopStub, startStub);

        assert.strictEqual(
            getReactNativePackageVersionsStub.calledWithExactly(
                path.join(projectPath, "node_modules"),
            ),
            true,
        );
        assert.strictEqual(isRunningStub.calledOnce, true);
        assert.strictEqual(stopStub.notCalled, true);
        assert.strictEqual(startStub.calledOnce, true);
    });

    test("should stop packager before starting it when it is running", async function () {
        const projectPath = path.join("test", "project");
        const isRunningStub = Sinon.stub().returns(Promise.resolve(true));
        const stopStub = Sinon.stub().returns(Promise.resolve());
        const startStub = Sinon.stub().returns(Promise.resolve());
        const { StartPackager } = createCommandModule();

        await runCommand(StartPackager, projectPath, isRunningStub, stopStub, startStub);

        assert.strictEqual(isRunningStub.calledOnce, true);
        assert.strictEqual(stopStub.calledOnce, true);
        assert.strictEqual(startStub.calledOnce, true);
        assert.strictEqual(stopStub.calledBefore(startStub), true);
    });
});
