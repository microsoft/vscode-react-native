// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("setNewArchCommand", function () {
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

    function createMockProject(projectPath: string): any {
        return {
            getPackager: () => ({
                getProjectPath: () => projectPath,
            }),
        };
    }

    function createCommandModule(
        showQuickPickStub: Sinon.SinonStub,
        writeFileStub: Sinon.SinonStub,
        spawnStub: Sinon.SinonStub,
        logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
            warning: Sinon.stub(),
            debug: Sinon.stub(),
        },
    ) {
        class FakeFileSystem {
            public writeFile = writeFileStub;
        }

        class FakeCommandExecutor {
            public spawn = spawnStub;
        }

        class FakeCommand {
            public static formInstance(this: new () => any): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/setNewArch", {
            vscode: {
                window: {
                    showQuickPick: showQuickPickStub,
                },
            },
            "../../common/node/fileSystem": {
                FileSystem: FakeFileSystem,
            },
            "../../common/commandExecutor": {
                CommandExecutor: FakeCommandExecutor,
            },
            "../appLauncher": {
                AppLauncher: {
                    getNodeModulesRootByProjectPath: () => path.join(tempDir, "node_modules"),
                },
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getMainChannel: () => logger,
                },
            },
            "./util/command": {
                Command: FakeCommand,
            },
        }) as typeof import("../../../src/extension/commands/setNewArch");

        return {
            SetNewArch: module.SetNewArch,
            logger,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/setNewArch").SetNewArch,
    ): Promise<void> {
        const command = commandClass.formInstance();
        (command as any).project = createMockProject(tempDir);
        await command.baseFn();
    }

    setup(function () {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "setNewArch-test-"));
    });

    teardown(function () {
        removeDirRecursive(tempDir);
    });

    test("should update existing Android newArchEnabled property", async function () {
        const androidPath = path.join(tempDir, "android");
        const gradleFilePath = path.join(androidPath, "gradle.properties");
        fs.mkdirSync(androidPath, { recursive: true });
        fs.writeFileSync(gradleFilePath, "android.useAndroidX=true\nnewArchEnabled=false");
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("Android"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("true"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const spawnStub = Sinon.stub().returns(Promise.resolve());
        const { SetNewArch } = createCommandModule(showQuickPickStub, writeFileStub, spawnStub);

        await runCommand(SetNewArch);

        assert.strictEqual(writeFileStub.calledOnce, true);
        assert.strictEqual(writeFileStub.firstCall.args[0], gradleFilePath);
        assert.strictEqual(
            writeFileStub.firstCall.args[1],
            "android.useAndroidX=true\nnewArchEnabled=true",
        );
        assert.strictEqual(spawnStub.called, false);
    });

    test("should append missing Android newArchEnabled property", async function () {
        const androidPath = path.join(tempDir, "android");
        const gradleFilePath = path.join(androidPath, "gradle.properties");
        fs.mkdirSync(androidPath, { recursive: true });
        fs.writeFileSync(gradleFilePath, "android.useAndroidX=true");
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("Android"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("false"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const spawnStub = Sinon.stub().returns(Promise.resolve());
        const { SetNewArch } = createCommandModule(showQuickPickStub, writeFileStub, spawnStub);

        await runCommand(SetNewArch);

        assert.strictEqual(writeFileStub.calledOnce, true);
        assert.strictEqual(writeFileStub.firstCall.args[0], gradleFilePath);
        assert.strictEqual(
            writeFileStub.firstCall.args[1],
            "android.useAndroidX=true \nnewArchEnabled=false",
        );
        assert.strictEqual(spawnStub.called, false);
    });

    test("should remove iOS new architecture disable line and install pods when enabling", async function () {
        const iosPath = path.join(tempDir, "ios");
        const podfilePath = path.join(iosPath, "Podfile");
        fs.mkdirSync(iosPath, { recursive: true });
        fs.writeFileSync(
            podfilePath,
            "ENV['RCT_NEW_ARCH_ENABLED'] = '0'\nuse_react_native!(:path => config[:reactNativePath])",
        );
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("iOS"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("true"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const spawnStub = Sinon.stub().returns(Promise.resolve());
        const { SetNewArch } = createCommandModule(showQuickPickStub, writeFileStub, spawnStub);

        await runCommand(SetNewArch);

        assert.strictEqual(writeFileStub.calledOnce, true);
        assert.strictEqual(writeFileStub.firstCall.args[0], podfilePath);
        assert.strictEqual(
            writeFileStub.firstCall.args[1],
            "use_react_native!(:path => config[:reactNativePath])",
        );
        assert.strictEqual(spawnStub.calledWithExactly("pod", ["install"]), true);
    });

    test("should prepend iOS new architecture disable line and install pods when disabling", async function () {
        const iosPath = path.join(tempDir, "ios");
        const podfilePath = path.join(iosPath, "Podfile");
        fs.mkdirSync(iosPath, { recursive: true });
        fs.writeFileSync(podfilePath, "use_react_native!(:path => config[:reactNativePath])");
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("iOS"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("false"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const spawnStub = Sinon.stub().returns(Promise.resolve());
        const { SetNewArch } = createCommandModule(showQuickPickStub, writeFileStub, spawnStub);

        await runCommand(SetNewArch);

        assert.strictEqual(writeFileStub.calledOnce, true);
        assert.strictEqual(writeFileStub.firstCall.args[0], podfilePath);
        assert.strictEqual(
            writeFileStub.firstCall.args[1],
            "ENV['RCT_NEW_ARCH_ENABLED'] = '0'\nuse_react_native!(:path => config[:reactNativePath])",
        );
        assert.strictEqual(spawnStub.calledWithExactly("pod", ["install"]), true);
    });

    test("should not write or install pods when enabling iOS new architecture and disable line is already absent", async function () {
        const iosPath = path.join(tempDir, "ios");
        const podfilePath = path.join(iosPath, "Podfile");
        fs.mkdirSync(iosPath, { recursive: true });
        fs.writeFileSync(podfilePath, "use_react_native!(:path => config[:reactNativePath])");
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("iOS"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("true"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const spawnStub = Sinon.stub().returns(Promise.resolve());
        const { SetNewArch } = createCommandModule(showQuickPickStub, writeFileStub, spawnStub);

        await runCommand(SetNewArch);

        assert.strictEqual(writeFileStub.called, false);
        assert.strictEqual(spawnStub.called, false);
    });

    test("should not write or install pods when disabling iOS new architecture and disable line already exists", async function () {
        const iosPath = path.join(tempDir, "ios");
        const podfilePath = path.join(iosPath, "Podfile");
        fs.mkdirSync(iosPath, { recursive: true });
        fs.writeFileSync(
            podfilePath,
            "ENV['RCT_NEW_ARCH_ENABLED'] = '0'\nuse_react_native!(:path => config[:reactNativePath])",
        );
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("iOS"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("false"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const spawnStub = Sinon.stub().returns(Promise.resolve());
        const { SetNewArch } = createCommandModule(showQuickPickStub, writeFileStub, spawnStub);

        await runCommand(SetNewArch);

        assert.strictEqual(writeFileStub.called, false);
        assert.strictEqual(spawnStub.called, false);
    });

    test("should return without writing when the platform selection is cancelled", async function () {
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve(undefined));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("true"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const spawnStub = Sinon.stub().returns(Promise.resolve());
        const { SetNewArch } = createCommandModule(showQuickPickStub, writeFileStub, spawnStub);

        await runCommand(SetNewArch);

        assert.strictEqual(writeFileStub.called, false);
        assert.strictEqual(spawnStub.called, false);
    });

    test("should return without writing when new architecture selection is cancelled", async function () {
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("Android"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve(undefined));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const spawnStub = Sinon.stub().returns(Promise.resolve());
        const { SetNewArch } = createCommandModule(showQuickPickStub, writeFileStub, spawnStub);

        await runCommand(SetNewArch);

        assert.strictEqual(writeFileStub.called, false);
        assert.strictEqual(spawnStub.called, false);
    });
});
