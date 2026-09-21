// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as path from "path";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("revertOpenModuleCommand", function () {
    const projectRoot = path.resolve("test-project");
    const projectPackageJsonPath = path.join(projectRoot, "package.json");

    function createCommandModule(options?: {
        rnVersion?: string;
        isCanaryVersion?: boolean;
        packageManager?: string;
        pnpmModules?: string[];
        moduleExists?: boolean;
        mainFileExists?: boolean;
        modulePackageJson?: Record<string, unknown>;
        unlinkError?: Error;
        writeError?: Error;
    }) {
        const rnVersion = options?.rnVersion || "0.60.0";
        const packageManager = options?.packageManager || "npm";
        const pnpmModulesPath = path.join(projectRoot, "node_modules", ".pnpm");
        const packageName =
            options?.isCanaryVersion || Number(rnVersion.split(".")[1]) >= 60 ? "open" : "opn";
        const pnpmModule = options?.pnpmModules?.find(module => /^open@/.test(module));
        const modulePath =
            packageManager === "pnpm" && pnpmModule
                ? path.join(pnpmModulesPath, pnpmModule, "node_modules", packageName)
                : path.resolve(projectRoot, "node_modules", packageName);
        const mainFilePath = path.resolve(modulePath, "open-main.js");
        const modulePackageJsonPath = path.resolve(modulePath, "package.json");
        const modulePackageJson = options?.modulePackageJson || {
            name: packageName,
            main: "open-main.js",
            version: "1.0.0",
        };
        const logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
        };
        const existsSyncStub = Sinon.stub().returns(false);
        existsSyncStub.withArgs(pnpmModulesPath).returns(packageManager === "pnpm");
        existsSyncStub.withArgs(modulePath).returns(options?.moduleExists !== false);
        existsSyncStub.withArgs(mainFilePath).returns(options?.mainFileExists !== false);
        const readFileSyncStub = Sinon.stub();
        readFileSyncStub
            .withArgs(projectPackageJsonPath, "utf-8")
            .returns(JSON.stringify({ dependencies: { "react-native": rnVersion } }));
        readFileSyncStub
            .withArgs(modulePackageJsonPath, "utf-8")
            .returns(JSON.stringify(modulePackageJson));
        const readdirSyncStub = Sinon.stub().returns(options?.pnpmModules || []);
        const unlinkSyncStub = Sinon.stub();
        if (options?.unlinkError) {
            unlinkSyncStub.throws(options.unlinkError);
        }
        const writeFileSyncStub = Sinon.stub();
        if (options?.writeError) {
            writeFileSyncStub.throws(options.writeError);
        }
        const isCanaryVersionStub = Sinon.stub().returns(options?.isCanaryVersion || false);
        const getPackageManagerStub = Sinon.stub().returns(packageManager);
        const findFileInFolderHierarchyStub = Sinon.stub().returns(projectPackageJsonPath);

        class FakeReactNativeCommand {
            public static formInstance(this: new () => any): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/revertOpenModule", {
            fs: {
                existsSync: existsSyncStub,
                readFileSync: readFileSyncStub,
                readdirSync: readdirSyncStub,
                unlinkSync: unlinkSyncStub,
                writeFileSync: writeFileSyncStub,
            },
            "vscode-nls": {
                MessageFormat: { bundle: "bundle" },
                BundleFormat: { standalone: "standalone" },
                config: Sinon.stub().returns(() => undefined),
                loadMessageBundle: Sinon.stub().returns((_key: string, message: string) => message),
            },
            "../../common/error/errorHelper": {
                ErrorHelper: {
                    getInternalError: Sinon.stub().returns(new Error("Revert failed")),
                },
            },
            "../../common/error/internalErrorCode": {
                InternalErrorCode: { FailedToRevertOpenModule: 119 },
            },
            "../../common/projectVersionHelper": {
                ProjectVersionHelper: { isCanaryVersion: isCanaryVersionStub },
            },
            "../../common/extensionHelper": {
                findFileInFolderHierarchy: findFileInFolderHierarchyStub,
            },
            "../settingsHelper": {
                SettingsHelper: { getPackageManager: getPackageManagerStub },
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: { getMainChannel: () => logger },
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/revertOpenModule");

        return {
            RevertOpenModule: module.RevertOpenModule,
            logger,
            modulePath,
            mainFilePath,
            modulePackageJsonPath,
            pnpmModulesPath,
            existsSyncStub,
            readFileSyncStub,
            readdirSyncStub,
            unlinkSyncStub,
            writeFileSyncStub,
            isCanaryVersionStub,
            getPackageManagerStub,
            findFileInFolderHierarchyStub,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/revertOpenModule").RevertOpenModule,
    ): Promise<any> {
        const command = commandClass.formInstance();
        (command as any).project = {
            getWorkspaceFolder: () => ({ uri: { fsPath: projectRoot } }),
        };
        await command.baseFn();
        return command;
    }

    test("should expose command metadata and require a project", async function () {
        const { RevertOpenModule } = createCommandModule();
        const command = RevertOpenModule.formInstance() as any;

        assert.strictEqual(command.codeName, "revertOpenModule");
        assert.strictEqual(command.label, "Revert extension input in open package module");
        assert.strictEqual(command.error.message, "Revert failed");
        await assert.rejects(() => command.baseFn(), assert.AssertionError);
    });

    test("should clean the open package for React Native 0.60 and preserve other metadata", async function () {
        const stubs = createCommandModule({
            modulePackageJson: {
                name: "open",
                main: "open-main.js",
                version: "8.4.2",
                scripts: { test: "node test.js" },
            },
        });

        await runCommand(stubs.RevertOpenModule);

        assert.strictEqual(stubs.unlinkSyncStub.calledWithExactly(stubs.mainFilePath), true);
        assert.strictEqual(stubs.writeFileSyncStub.calledOnce, true);
        assert.strictEqual(stubs.writeFileSyncStub.firstCall.args[0], stubs.modulePackageJsonPath);
        assert.deepStrictEqual(JSON.parse(stubs.writeFileSyncStub.firstCall.args[1]), {
            name: "open",
            version: "8.4.2",
            scripts: { test: "node test.js" },
        });
        assert.strictEqual(stubs.logger.info.calledOnce, true);
    });

    test("should select the opn package for React Native versions below 0.60", async function () {
        const stubs = createCommandModule({ rnVersion: "0.59.10" });

        await runCommand(stubs.RevertOpenModule);

        assert.strictEqual(stubs.modulePath.endsWith(path.join("node_modules", "opn")), true);
        assert.strictEqual(stubs.existsSyncStub.calledWith(stubs.modulePath), true);
        assert.strictEqual(stubs.unlinkSyncStub.calledWithExactly(stubs.mainFilePath), true);
    });

    test("should select the open package for React Native canary versions", async function () {
        const stubs = createCommandModule({ rnVersion: "0.0.0", isCanaryVersion: true });

        await runCommand(stubs.RevertOpenModule);

        assert.strictEqual(stubs.isCanaryVersionStub.calledWithExactly("0.0.0"), true);
        assert.strictEqual(stubs.modulePath.endsWith(path.join("node_modules", "open")), true);
        assert.strictEqual(stubs.unlinkSyncStub.calledWithExactly(stubs.mainFilePath), true);
    });

    test("should resolve the open package from the pnpm virtual store", async function () {
        const stubs = createCommandModule({
            packageManager: "pnpm",
            pnpmModules: ["other@1.0.0", "open@8.4.2"],
        });

        await runCommand(stubs.RevertOpenModule);

        assert.strictEqual(stubs.getPackageManagerStub.calledOnce, true);
        assert.strictEqual(stubs.readdirSyncStub.calledWithExactly(stubs.pnpmModulesPath), true);
        assert.strictEqual(
            stubs.modulePath.endsWith(path.join(".pnpm", "open@8.4.2", "node_modules", "open")),
            true,
        );
        assert.strictEqual(stubs.unlinkSyncStub.calledWithExactly(stubs.mainFilePath), true);
    });

    test("should log and continue when open-main.js is missing", async function () {
        const stubs = createCommandModule({ mainFileExists: false });

        await runCommand(stubs.RevertOpenModule);

        assert.strictEqual(stubs.unlinkSyncStub.called, false);
        assert.strictEqual(stubs.logger.info.callCount, 2);
        assert.strictEqual(stubs.writeFileSyncStub.calledOnce, true);
    });

    test("should leave package.json unchanged when the injected main entry is absent", async function () {
        const stubs = createCommandModule({
            modulePackageJson: { name: "open", main: "index.js", version: "8.4.2" },
        });

        await runCommand(stubs.RevertOpenModule);

        assert.strictEqual(stubs.writeFileSyncStub.called, false);
        assert.strictEqual(stubs.logger.info.callCount, 2);
    });

    test("should log an error when the package module cannot be found", async function () {
        const stubs = createCommandModule({ moduleExists: false });

        await runCommand(stubs.RevertOpenModule);

        assert.strictEqual(stubs.unlinkSyncStub.called, false);
        assert.strictEqual(stubs.writeFileSyncStub.called, false);
        assert.strictEqual(stubs.logger.error.calledOnce, true);
        assert.strictEqual(stubs.logger.info.called, false);
    });

    test("should log a deletion failure and still restore package.json", async function () {
        const stubs = createCommandModule({ unlinkError: new Error("Delete failed") });

        await runCommand(stubs.RevertOpenModule);

        assert.strictEqual(stubs.logger.error.calledOnce, true);
        assert.strictEqual(stubs.writeFileSyncStub.calledOnce, true);
        assert.strictEqual(stubs.logger.info.calledOnce, true);
    });

    test("should log a package.json write failure without rejecting", async function () {
        const stubs = createCommandModule({ writeError: new Error("Write failed") });

        await runCommand(stubs.RevertOpenModule);

        assert.strictEqual(stubs.logger.error.calledOnce, true);
        assert.strictEqual(stubs.logger.info.calledOnce, true);
    });
});
