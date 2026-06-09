// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("configEASBuildCommand", function () {
    function createMockProject(projectPath: string, isExpoStub: Sinon.SinonStub): any {
        return {
            getPackager: () => ({
                getProjectPath: () => projectPath,
            }),
            getExponentHelper: () => ({
                isExpoManagedApp: isExpoStub,
            }),
        };
    }

    function createCommandModule(
        existsStub: Sinon.SinonStub,
        executeStub: Sinon.SinonStub,
        logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
            warning: Sinon.stub(),
            debug: Sinon.stub(),
        },
    ) {
        class FakeFileSystem {
            public exists = existsStub;
        }

        class FakeCommandExecutor {
            public execute = executeStub;
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/configEASBuild", {
            "../../common/node/fileSystem": {
                FileSystem: FakeFileSystem,
            },
            "../../common/commandExecutor": {
                CommandExecutor: FakeCommandExecutor,
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getMainChannel: () => logger,
                },
            },
        }) as typeof import("../../../src/extension/commands/configEASBuild");

        return {
            ConfigEASBuild: module.ConfigEASBuild,
            logger,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/configEASBuild").ConfigEASBuild,
        projectPath: string,
        isExpoStub: Sinon.SinonStub,
    ): Promise<void> {
        const command = commandClass.formInstance();
        (command as any).project = createMockProject(projectPath, isExpoStub);
        (command as any).nodeModulesRoot = `${projectPath}/node_modules`;
        await command.baseFn();
    }

    test("should reject non-Expo projects", async function () {
        const existsStub = Sinon.stub().returns(Promise.resolve(false));
        const executeStub = Sinon.stub().returns(Promise.resolve());
        const isExpoStub = Sinon.stub().returns(Promise.resolve(false));
        const { ConfigEASBuild } = createCommandModule(existsStub, executeStub);

        await assert.rejects(
            runCommand(ConfigEASBuild, "/workspace/app", isExpoStub),
            /not an Expo application/,
        );

        assert.strictEqual(isExpoStub.calledWithExactly(true), true);
        assert.strictEqual(existsStub.called, false);
        assert.strictEqual(executeStub.called, false);
    });

    test("should return early when eas.json already exists", async function () {
        const existsStub = Sinon.stub().returns(Promise.resolve(true));
        const executeStub = Sinon.stub().returns(Promise.resolve());
        const isExpoStub = Sinon.stub().returns(Promise.resolve(true));
        const { ConfigEASBuild, logger } = createCommandModule(existsStub, executeStub);

        await runCommand(ConfigEASBuild, "/workspace/app", isExpoStub);

        assert.strictEqual(existsStub.calledWithExactly("/workspace/app/eas.json"), true);
        assert.strictEqual(executeStub.called, false);
        assert.strictEqual(
            logger.info.args.some((args: string[]) =>
                args[0].includes("eas.json file already existing"),
            ),
            true,
        );
    });

    test("should run eas build configure for Expo projects without eas.json", async function () {
        const existsStub = Sinon.stub().returns(Promise.resolve(false));
        const executeStub = Sinon.stub().returns(Promise.resolve());
        const isExpoStub = Sinon.stub().returns(Promise.resolve(true));
        const { ConfigEASBuild, logger } = createCommandModule(existsStub, executeStub);

        await runCommand(ConfigEASBuild, "/workspace/app", isExpoStub);

        assert.strictEqual(
            executeStub.calledWithExactly("eas build:configure --platform all"),
            true,
        );
        assert.strictEqual(
            logger.info.args.some((args: string[]) =>
                args[0].includes("Create EAS build config file successfully"),
            ),
            true,
        );
    });
});
