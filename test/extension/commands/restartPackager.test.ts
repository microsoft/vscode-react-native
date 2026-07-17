// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as path from "path";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("restartPackagerCommand", function () {
    function createMockProject(projectPath: string, restartStub: Sinon.SinonStub): any {
        return {
            getOrUpdateNodeModulesRoot: () => path.join(projectPath, "node_modules"),
            getWorkspaceFolderUri: () => ({
                fsPath: projectPath,
            }),
            getPackager: () => ({
                restart: restartStub,
            }),
        };
    }

    function createCommandModule(
        getReactNativePackageVersionsStub = Sinon.stub().returns(Promise.resolve({})),
        getPackagerPortStub = Sinon.stub().returns(9090),
    ) {
        class FakeReactNativeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/restartPackager", {
            "../../common/projectVersionHelper": {
                ProjectVersionHelper: {
                    getReactNativePackageVersionsFromNodeModules: getReactNativePackageVersionsStub,
                },
            },
            "../settingsHelper": {
                SettingsHelper: {
                    getPackagerPort: getPackagerPortStub,
                },
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/restartPackager");

        return {
            RestartPackager: module.RestartPackager,
            getReactNativePackageVersionsStub,
            getPackagerPortStub,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/restartPackager").RestartPackager,
        projectPath: string,
        restartStub: Sinon.SinonStub,
    ): Promise<void> {
        const command = commandClass.formInstance();
        (command as any).project = createMockProject(projectPath, restartStub);
        await command.baseFn();
    }

    test("should check React Native package versions before restarting packager", async function () {
        const projectPath = path.join("test", "project");
        const restartStub = Sinon.stub().returns(Promise.resolve());
        const { RestartPackager, getReactNativePackageVersionsStub } = createCommandModule();

        await runCommand(RestartPackager, projectPath, restartStub);

        assert.strictEqual(
            getReactNativePackageVersionsStub.calledWithExactly(
                path.join(projectPath, "node_modules"),
            ),
            true,
        );
        assert.strictEqual(restartStub.calledOnce, true);
        assert.strictEqual(getReactNativePackageVersionsStub.calledBefore(restartStub), true);
    });

    test("should not restart packager when React Native package version check fails", async function () {
        const projectPath = path.join("test", "project");
        const restartStub = Sinon.stub().returns(Promise.resolve());
        const error = new Error("version check failed");
        const getReactNativePackageVersionsStub = Sinon.stub().returns(Promise.reject(error));
        const { RestartPackager, getPackagerPortStub } = createCommandModule(
            getReactNativePackageVersionsStub,
        );

        await assert.rejects(() => runCommand(RestartPackager, projectPath, restartStub), error);

        assert.strictEqual(restartStub.called, false);
        assert.strictEqual(getPackagerPortStub.called, false);
    });

    test("should restart packager with the configured port", async function () {
        const projectPath = path.join("test", "project");
        const restartStub = Sinon.stub().returns(Promise.resolve());
        const getPackagerPortStub = Sinon.stub().returns(19000);
        const { RestartPackager } = createCommandModule(undefined, getPackagerPortStub);

        await runCommand(RestartPackager, projectPath, restartStub);

        assert.strictEqual(getPackagerPortStub.calledWithExactly(projectPath), true);
        assert.strictEqual(restartStub.calledWithExactly(19000), true);
    });
});
