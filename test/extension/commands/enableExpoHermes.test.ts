// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("enableExpoHermesCommand", function () {
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

        class FakeCommand {
            public static formInstance(this: new () => any): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/enableExpoHermes", {
            vscode: {
                window: {
                    showQuickPick: showQuickPickStub,
                },
            },
            "../../common/node/fileSystem": {
                FileSystem: FakeFileSystem,
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getMainChannel: () => logger,
                },
            },
            "./util/command": {
                Command: FakeCommand,
            },
        }) as typeof import("../../../src/extension/commands/enableExpoHermes");

        return {
            EnableExpoHermes: module.EnableExpoHermes,
            logger,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/enableExpoHermes").EnableExpoHermes,
    ): Promise<void> {
        const command = commandClass.formInstance();
        (command as any).project = createMockProject(tempDir);
        await command.baseFn();
    }

    function writeAppJson(contents: string): string {
        const appJsonPath = path.join(tempDir, "app.json");
        fs.writeFileSync(appJsonPath, contents);
        return appJsonPath;
    }

    setup(function () {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enableExpoHermes-test-"));
    });

    teardown(function () {
        removeDirRecursive(tempDir);
    });

    test("should warn when app.json is missing", async function () {
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("Expo"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("hermes"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const { EnableExpoHermes, logger } = createCommandModule(showQuickPickStub, writeFileStub);

        await runCommand(EnableExpoHermes);

        assert.strictEqual(logger.warning.calledWithExactly("app.json not found"), true);
        assert.strictEqual(writeFileStub.called, false);
    });

    test("should set expo jsEngine when no existing value is present", async function () {
        const appJsonPath = writeAppJson(JSON.stringify({ expo: { name: "Sample" } }, null, 2));
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("Expo"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("hermes"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const { EnableExpoHermes } = createCommandModule(showQuickPickStub, writeFileStub);

        await runCommand(EnableExpoHermes);

        assert.strictEqual(writeFileStub.calledOnce, true);
        assert.strictEqual(writeFileStub.firstCall.args[0], appJsonPath);
        assert.deepStrictEqual(JSON.parse(writeFileStub.firstCall.args[1]), {
            expo: {
                name: "Sample",
                jsEngine: "hermes",
            },
        });
    });

    test("should set Android jsEngine when no existing value is present", async function () {
        const appJsonPath = writeAppJson(
            JSON.stringify({ expo: { android: { package: "com.contoso.app" } } }, null, 2),
        );
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("Android"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("jsc"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const { EnableExpoHermes } = createCommandModule(showQuickPickStub, writeFileStub);

        await runCommand(EnableExpoHermes);

        assert.strictEqual(writeFileStub.calledOnce, true);
        assert.strictEqual(writeFileStub.firstCall.args[0], appJsonPath);
        assert.deepStrictEqual(JSON.parse(writeFileStub.firstCall.args[1]), {
            expo: {
                android: {
                    package: "com.contoso.app",
                    jsEngine: "jsc",
                },
            },
        });
    });

    test("should set iOS jsEngine when no existing value is present", async function () {
        const appJsonPath = writeAppJson(
            JSON.stringify({ expo: { ios: { bundleIdentifier: "com.contoso.app" } } }, null, 2),
        );
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("iOS"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("hermes"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const { EnableExpoHermes } = createCommandModule(showQuickPickStub, writeFileStub);

        await runCommand(EnableExpoHermes);

        assert.strictEqual(writeFileStub.calledOnce, true);
        assert.strictEqual(writeFileStub.firstCall.args[0], appJsonPath);
        assert.deepStrictEqual(JSON.parse(writeFileStub.firstCall.args[1]), {
            expo: {
                ios: {
                    bundleIdentifier: "com.contoso.app",
                    jsEngine: "hermes",
                },
            },
        });
    });

    test("should create Android section when setting Android jsEngine", async function () {
        const appJsonPath = writeAppJson(JSON.stringify({ expo: { name: "Sample" } }, null, 2));
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("Android"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("hermes"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const { EnableExpoHermes } = createCommandModule(showQuickPickStub, writeFileStub);

        await runCommand(EnableExpoHermes);

        assert.strictEqual(writeFileStub.calledOnce, true);
        assert.strictEqual(writeFileStub.firstCall.args[0], appJsonPath);
        assert.deepStrictEqual(JSON.parse(writeFileStub.firstCall.args[1]), {
            expo: {
                name: "Sample",
                android: {
                    jsEngine: "hermes",
                },
            },
        });
    });

    test("should create iOS section when setting iOS jsEngine", async function () {
        const appJsonPath = writeAppJson(JSON.stringify({ expo: { name: "Sample" } }, null, 2));
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("iOS"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("jsc"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const { EnableExpoHermes } = createCommandModule(showQuickPickStub, writeFileStub);

        await runCommand(EnableExpoHermes);

        assert.strictEqual(writeFileStub.calledOnce, true);
        assert.strictEqual(writeFileStub.firstCall.args[0], appJsonPath);
        assert.deepStrictEqual(JSON.parse(writeFileStub.firstCall.args[1]), {
            expo: {
                name: "Sample",
                ios: {
                    jsEngine: "jsc",
                },
            },
        });
    });

    test("should update an existing jsEngine value in the matched platform section", async function () {
        const appJsonPath = writeAppJson(`{
  "expo": {
    "android": {
      "jsEngine": "jsc"
    }
  }
}`);
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("Android"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("hermes"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const { EnableExpoHermes } = createCommandModule(showQuickPickStub, writeFileStub);

        await runCommand(EnableExpoHermes);

        assert.strictEqual(writeFileStub.calledOnce, true);
        assert.strictEqual(writeFileStub.firstCall.args[0], appJsonPath);
        assert.strictEqual(writeFileStub.firstCall.args[1].includes('"jsEngine": "hermes"'), true);
    });

    test("should not update iOS jsEngine when Android is selected", async function () {
        const appJsonPath = writeAppJson(`{
  "expo": {
    "ios": {
      "jsEngine": "jsc"
    },
    "android": {
      "jsEngine": "jsc"
    }
  }
}`);
        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("Android"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("hermes"));
        const writeFileStub = Sinon.stub().returns(Promise.resolve());
        const { EnableExpoHermes } = createCommandModule(showQuickPickStub, writeFileStub);

        await runCommand(EnableExpoHermes);

        assert.strictEqual(writeFileStub.calledOnce, true);
        assert.strictEqual(writeFileStub.firstCall.args[0], appJsonPath);
        assert.deepStrictEqual(JSON.parse(writeFileStub.firstCall.args[1]), {
            expo: {
                ios: {
                    jsEngine: "jsc",
                },
                android: {
                    jsEngine: "hermes",
                },
            },
        });
    });
});
