// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");
import { HostPlatformId } from "../../../src/common/hostPlatform";

suite("cleanRestartPackagerCommand", function () {
    let tempDir: string;

    function removeDirRecursive(dirPath: string): void {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                const currentPath = path.join(dirPath, file);
                if (fs.lstatSync(currentPath).isDirectory()) {
                    removeDirRecursive(currentPath);
                } else {
                    fs.unlinkSync(currentPath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }

    function createExecResult(outcome: string): any {
        return Promise.resolve({
            process: {},
            outcome: Promise.resolve(outcome),
        });
    }

    function createRejectedExecResult(error: Error): any {
        return Promise.resolve({
            process: {},
            outcome: Promise.reject(error),
        });
    }

    function createMockProject(projectPath: string, restartStub: Sinon.SinonStub): any {
        return {
            getOrUpdateNodeModulesRoot: () => path.join(projectPath, "node_modules"),
            getWorkspaceFolderUri: () => ({
                fsPath: projectPath,
            }),
            getPackager: () => ({
                getProjectPath: () => projectPath,
                restart: restartStub,
            }),
        };
    }

    function createCommandModule(
        platformId: number,
        execStub: Sinon.SinonStub,
        logger = {
            info: Sinon.stub(),
            warning: Sinon.stub(),
            error: Sinon.stub(),
            debug: Sinon.stub(),
        },
    ) {
        class FakeChildProcess {
            public exec = execStub;
        }

        const getReactNativePackageVersionsStub = Sinon.stub().returns(Promise.resolve({}));
        const getPackagerPortStub = Sinon.stub().returns(9090);

        const module = proxyquire.noCallThru()(
            "../../../src/extension/commands/cleanRestartPackager",
            {
                "../../common/projectVersionHelper": {
                    ProjectVersionHelper: {
                        getReactNativePackageVersionsFromNodeModules:
                            getReactNativePackageVersionsStub,
                    },
                },
                "../settingsHelper": {
                    SettingsHelper: {
                        getPackagerPort: getPackagerPortStub,
                    },
                },
                "../../common/node/childProcess": {
                    ChildProcess: FakeChildProcess,
                },
                "../log/OutputChannelLogger": {
                    OutputChannelLogger: {
                        getMainChannel: () => logger,
                    },
                },
                "../../common/hostPlatform": {
                    HostPlatform: {
                        getPlatformId: () => platformId,
                    },
                    HostPlatformId,
                },
            },
        ) as typeof import("../../../src/extension/commands/cleanRestartPackager");

        return {
            CleanRestartPackager: module.CleanRestartPackager,
            getReactNativePackageVersionsStub,
            getPackagerPortStub,
            logger,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/cleanRestartPackager").CleanRestartPackager,
        projectPath: string,
        restartStub: Sinon.SinonStub,
    ): Promise<void> {
        const command = commandClass.formInstance();
        (command as any).project = createMockProject(projectPath, restartStub);
        await command.baseFn();
    }

    setup(function () {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cleanRestartPackager-test-"));
    });

    teardown(function () {
        removeDirRecursive(tempDir);
    });

    test("should kill Metro process on Windows and restart packager", async function () {
        const execStub = Sinon.stub();
        execStub
            .withArgs("netstat -ano | findstr :9090")
            .returns(createExecResult("TCP    127.0.0.1:9090    0.0.0.0:0    LISTENING    12345"));
        execStub.withArgs("taskkill /PID 12345 /F /T").returns(createExecResult(""));
        execStub.withArgs("watchman watch-del-all").returns(createExecResult(""));
        const restartStub = Sinon.stub().returns(Promise.resolve());
        const { CleanRestartPackager } = createCommandModule(HostPlatformId.WINDOWS, execStub);

        await runCommand(CleanRestartPackager, tempDir, restartStub);

        assert.strictEqual(execStub.calledWith("netstat -ano | findstr :9090"), true);
        assert.strictEqual(execStub.calledWith("taskkill /PID 12345 /F /T"), true);
        assert.strictEqual(execStub.calledWith("watchman watch-del-all"), true);
        assert.strictEqual(restartStub.calledOnce, true);
        assert.strictEqual(restartStub.calledWithExactly(9090), true);
    });

    test("should kill Metro process on macOS and restart packager", async function () {
        const execStub = Sinon.stub();
        execStub.withArgs("lsof -ti:9090").returns(createExecResult("23456\n"));
        execStub.withArgs("kill -9 23456").returns(createExecResult(""));
        execStub.withArgs("watchman watch-del-all").returns(createExecResult(""));
        const restartStub = Sinon.stub().returns(Promise.resolve());
        const { CleanRestartPackager } = createCommandModule(HostPlatformId.OSX, execStub);

        await runCommand(CleanRestartPackager, tempDir, restartStub);

        assert.strictEqual(execStub.calledWith("lsof -ti:9090"), true);
        assert.strictEqual(execStub.calledWith("kill -9 23456"), true);
        assert.strictEqual(execStub.calledWith("watchman watch-del-all"), true);
        assert.strictEqual(restartStub.calledOnce, true);
        assert.strictEqual(restartStub.calledWithExactly(9090), true);
    });

    test("should remove Metro cache recursively before restarting packager", async function () {
        const metroCachePath = path.join(tempDir, "node_modules", ".cache", "metro");
        const nestedCachePath = path.join(metroCachePath, "nested");
        fs.mkdirSync(nestedCachePath, { recursive: true });
        fs.writeFileSync(path.join(metroCachePath, "cache-file"), "cache");
        fs.writeFileSync(path.join(nestedCachePath, "nested-cache-file"), "cache");

        const execStub = Sinon.stub();
        execStub.withArgs("lsof -ti:9090").returns(createExecResult(""));
        execStub.withArgs("watchman watch-del-all").returns(createExecResult(""));
        const restartStub = Sinon.stub().returns(Promise.resolve());
        const { CleanRestartPackager } = createCommandModule(HostPlatformId.LINUX, execStub);

        await runCommand(CleanRestartPackager, tempDir, restartStub);

        assert.strictEqual(fs.existsSync(metroCachePath), false);
        assert.strictEqual(restartStub.calledOnce, true);
        assert.strictEqual(restartStub.calledWithExactly(9090), true);
    });

    test("should skip missing Metro cache and restart packager", async function () {
        const execStub = Sinon.stub();
        execStub.withArgs("lsof -ti:9090").returns(createExecResult(""));
        execStub.withArgs("watchman watch-del-all").returns(createExecResult(""));
        const restartStub = Sinon.stub().returns(Promise.resolve());
        const { CleanRestartPackager } = createCommandModule(HostPlatformId.LINUX, execStub);

        await runCommand(CleanRestartPackager, tempDir, restartStub);

        assert.strictEqual(
            fs.existsSync(path.join(tempDir, "node_modules", ".cache", "metro")),
            false,
        );
        assert.strictEqual(restartStub.calledOnce, true);
        assert.strictEqual(restartStub.calledWithExactly(9090), true);
    });

    test("should continue when Watchman cleanup fails", async function () {
        const execStub = Sinon.stub();
        execStub.withArgs("lsof -ti:9090").returns(createExecResult(""));
        execStub
            .withArgs("watchman watch-del-all")
            .returns(createRejectedExecResult(new Error("watchman unavailable")));
        const restartStub = Sinon.stub().returns(Promise.resolve());
        const { CleanRestartPackager } = createCommandModule(HostPlatformId.LINUX, execStub);

        await runCommand(CleanRestartPackager, tempDir, restartStub);

        assert.strictEqual(execStub.calledWith("watchman watch-del-all"), true);
        assert.strictEqual(restartStub.calledOnce, true);
        assert.strictEqual(restartStub.calledWithExactly(9090), true);
    });

    test("should continue when Metro process lookup fails", async function () {
        const execStub = Sinon.stub();
        execStub
            .withArgs("lsof -ti:9090")
            .returns(createRejectedExecResult(new Error("lsof failed")));
        execStub.withArgs("watchman watch-del-all").returns(createExecResult(""));
        const restartStub = Sinon.stub().returns(Promise.resolve());
        const { CleanRestartPackager } = createCommandModule(HostPlatformId.LINUX, execStub);

        await runCommand(CleanRestartPackager, tempDir, restartStub);

        assert.strictEqual(execStub.calledWith("lsof -ti:9090"), true);
        assert.strictEqual(execStub.calledWith("watchman watch-del-all"), true);
        assert.strictEqual(restartStub.calledOnce, true);
        assert.strictEqual(restartStub.calledWithExactly(9090), true);
    });
});
