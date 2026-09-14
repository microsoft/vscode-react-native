// test/extension/commands/installPods.test.ts

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import fs = require("fs");
import os = require("os");
import Sinon = require("sinon");
import * as path from "path";
import * as vscode from "vscode";
import { InstallPods } from "../../../src/extension/commands/installPods";
import { AppLauncher } from "../../../src/extension/appLauncher";
import { OutputChannelLogger } from "../../../src/extension/log/OutputChannelLogger";

suite("installPodsCommand", function () {
    let showWarningMessageStub: Sinon.SinonStub;
    let showErrorMessageStub: Sinon.SinonStub;
    let showInformationMessageStub: Sinon.SinonStub;
    let loggerErrorStub: Sinon.SinonStub;
    let getMainChannelStub: Sinon.SinonStub;

    let tempDir: string;
    let installPodsCommand: InstallPods;

    const isMac = process.platform === "darwin";

    /**
     * Helper function to remove directory recursively
     */
    function removeDirRecursive(dirPath: string): void {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                const curPath = path.join(dirPath, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    removeDirRecursive(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }

    /**
     * Helper function to create a mock AppLauncher project
     */
    function createMockProject(projectPath: string, nodeModulesRoot: string): AppLauncher {
        return {
            getPackager: () => ({
                getProjectPath: () => projectPath,
            }),
            getOrUpdateNodeModulesRoot: () => nodeModulesRoot,
            getWorkspaceFolder: () => ({
                uri: {
                    fsPath: projectPath,
                },
            }),
        } as unknown as AppLauncher;
    }

    function getPodSearchPaths(homeDir: string): string[] {
        return [
            `${homeDir}/.rbenv/shims/pod`,
            `${homeDir}/.rvm/bin/pod`,
            "/opt/homebrew/bin/pod",
            "/usr/local/bin/pod",
            "/Library/Ruby/Gems/2.6.0/bin/pod",
            "/Library/Ruby/Gems/3.0.0/bin/pod",
            "/Library/Ruby/Gems/3.3.0/bin/pod",
        ];
    }

    function findPodCommand(): string {
        return (installPodsCommand as any).findPodCommand();
    }

    function getEnhancedEnvironment(): { [key: string]: string } {
        return (installPodsCommand as any).getEnhancedEnvironment();
    }

    function getSuggestionForError(errorMessage: string): string {
        return (installPodsCommand as any).getSuggestionForError(errorMessage);
    }

    setup(function () {
        // Create temp directory for tests
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "installPods-test-"));

        // Stub vscode.window methods
        showWarningMessageStub = Sinon.stub(vscode.window, "showWarningMessage");
        showErrorMessageStub = Sinon.stub(vscode.window, "showErrorMessage");
        showInformationMessageStub = Sinon.stub(vscode.window, "showInformationMessage");

        // Stub OutputChannelLogger
        const mockLogger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
            warning: Sinon.stub(),
            debug: Sinon.stub(),
        };
        loggerErrorStub = mockLogger.error;
        getMainChannelStub = Sinon.stub(OutputChannelLogger, "getMainChannel").returns(
            mockLogger as unknown as OutputChannelLogger,
        );

        // Create InstallPods instance
        installPodsCommand = InstallPods.formInstance();
    });

    teardown(function () {
        // Restore all stubs
        showWarningMessageStub.restore();
        showErrorMessageStub.restore();
        showInformationMessageStub.restore();
        getMainChannelStub.restore();

        // Clean up temp directory
        removeDirRecursive(tempDir);
    });

    suite("Platform checks", function () {
        test("should show warning on non-macOS platform", async function () {
            // Skip this test on macOS since we want to test non-macOS behavior
            if (isMac) {
                return;
            }

            // Mock project
            const mockProject = createMockProject(tempDir, path.join(tempDir, "node_modules"));
            (installPodsCommand as any).project = mockProject;

            await installPodsCommand.baseFn();

            assert.ok(
                showWarningMessageStub.calledOnce,
                "Should show warning message on non-macOS",
            );
            assert.ok(
                showWarningMessageStub.firstCall.args[0].includes("macOS"),
                "Warning message should mention macOS",
            );
        });
    });

    suite("Directory validation", function () {
        test("should show error when ios directory does not exist", async function () {
            // Skip on non-macOS
            if (!isMac) {
                return;
            }

            // Use temp directory without ios folder
            const mockProject = createMockProject(tempDir, path.join(tempDir, "node_modules"));
            (installPodsCommand as any).project = mockProject;

            await installPodsCommand.baseFn();

            assert.ok(
                loggerErrorStub.calledOnce,
                "Should log error message when ios directory is missing",
            );
            assert.ok(
                loggerErrorStub.firstCall.args[0].includes("iOS directory") ||
                    loggerErrorStub.firstCall.args[0].includes("iOS"),
                "Error message should mention iOS directory",
            );
        });

        test("should show error when Podfile does not exist", async function () {
            // Skip on non-macOS
            if (!isMac) {
                return;
            }

            // Create ios directory without Podfile
            const iosPath = path.join(tempDir, "ios");
            fs.mkdirSync(iosPath, { recursive: true });

            const mockProject = createMockProject(tempDir, path.join(tempDir, "node_modules"));
            (installPodsCommand as any).project = mockProject;

            await installPodsCommand.baseFn();

            assert.ok(
                loggerErrorStub.calledOnce,
                "Should log error message when Podfile is missing",
            );
            assert.ok(
                loggerErrorStub.firstCall.args[0].includes("Podfile"),
                "Error message should mention Podfile",
            );
        });
    });

    suite("Pod command discovery", function () {
        const homeDir = "/Users/test-user";

        test("should return each executable pod path found in lookup order", function () {
            const podPaths = getPodSearchPaths(homeDir);

            for (const [index, expectedPodPath] of podPaths.entries()) {
                const homedirStub = Sinon.stub(os, "homedir").returns(homeDir);
                const existsSyncStub = Sinon.stub(
                    fs,
                    "existsSync",
                    function (filePath: fs.PathLike): boolean {
                        return filePath === expectedPodPath;
                    },
                );
                const accessSyncStub = Sinon.stub(fs, "accessSync");

                try {
                    assert.strictEqual(findPodCommand(), expectedPodPath);
                    assert.deepStrictEqual(
                        existsSyncStub.args.map((args: any[]) => args[0]),
                        podPaths.slice(0, index + 1),
                    );
                    assert.ok(accessSyncStub.calledOnce);
                    assert.ok(accessSyncStub.calledWithExactly(expectedPodPath, fs.constants.X_OK));
                } finally {
                    homedirStub.restore();
                    existsSyncStub.restore();
                    accessSyncStub.restore();
                }
            }
        });

        test("should continue searching when a found pod path is not executable", function () {
            const podPaths = getPodSearchPaths(homeDir);
            const nonExecutablePodPath = podPaths[0];
            const expectedPodPath = podPaths[1];
            const homedirStub = Sinon.stub(os, "homedir").returns(homeDir);
            const existsSyncStub = Sinon.stub(
                fs,
                "existsSync",
                function (filePath: fs.PathLike): boolean {
                    return filePath === nonExecutablePodPath || filePath === expectedPodPath;
                },
            );
            const accessSyncStub = Sinon.stub(
                fs,
                "accessSync",
                function (filePath: fs.PathLike): void {
                    if (filePath === nonExecutablePodPath) {
                        throw new Error("not executable");
                    }
                },
            );

            try {
                assert.strictEqual(findPodCommand(), expectedPodPath);
                assert.deepStrictEqual(
                    existsSyncStub.args.map((args: any[]) => args[0]),
                    podPaths.slice(0, 2),
                );
                assert.strictEqual(accessSyncStub.callCount, 2);
            } finally {
                homedirStub.restore();
                existsSyncStub.restore();
                accessSyncStub.restore();
            }
        });

        test("should fall back to pod from PATH when no known path exists", function () {
            const homedirStub = Sinon.stub(os, "homedir").returns(homeDir);
            const existsSyncStub = Sinon.stub(fs, "existsSync", function () {
                return false;
            });
            const accessSyncStub = Sinon.stub(fs, "accessSync");

            try {
                assert.strictEqual(findPodCommand(), "pod");
                assert.strictEqual(existsSyncStub.callCount, getPodSearchPaths(homeDir).length);
                assert.strictEqual(accessSyncStub.callCount, 0);
            } finally {
                homedirStub.restore();
                existsSyncStub.restore();
                accessSyncStub.restore();
            }
        });
    });

    suite("Error suggestions", function () {
        test("should suggest installing CocoaPods when the pod command is missing", function () {
            const suggestion = getSuggestionForError("pod: not found");

            assert.ok(suggestion.includes("CocoaPods may not be installed"));
            assert.ok(suggestion.includes("brew install cocoapods"));
        });

        test("should suggest updating CocoaPods repos for CDN errors", function () {
            const suggestion = getSuggestionForError(
                "Failed to fetch https://trunk.cocoapods.org/all_pods_versions.txt",
            );

            assert.ok(suggestion.includes("CDN error"));
            assert.ok(suggestion.includes("pod repo update"));
        });

        test("should suggest installing Xcode command line tools for Xcode errors", function () {
            const suggestion = getSuggestionForError("xcrun: error: invalid active developer path");

            assert.ok(suggestion.includes("xcode-select --install"));
        });

        test("should suggest checking Ruby installation for Ruby errors", function () {
            const suggestion = getSuggestionForError("Ruby version 2.6.0 is unsupported");

            assert.ok(suggestion.includes("Ruby environment issue"));
            assert.ok(suggestion.includes("ruby --version"));
        });

        test("should suggest checking permissions for permission errors", function () {
            const suggestion = getSuggestionForError("Permission denied while writing Pods");

            assert.ok(suggestion.includes("Permission denied"));
            assert.ok(suggestion.includes("directory permissions"));
        });

        test("should suggest updating gems for gem errors", function () {
            const suggestion = getSuggestionForError("Gem::MissingSpecError could not find pod");

            assert.ok(suggestion.includes("Ruby gem issue"));
            assert.ok(suggestion.includes("gem update --system"));
        });
    });

    suite("Enhanced environment", function () {
        test("should inject Ruby and CocoaPods paths and default shell and locale values", function () {
            if (process.platform !== "darwin") {
                this.skip();
            }
            const homeDir = "/Users/test-user";
            const originalEnv = {
                PATH: process.env.PATH,
                RBENV_ROOT: process.env.RBENV_ROOT,
                RBENV_VERSION: process.env.RBENV_VERSION,
                GEM_HOME: process.env.GEM_HOME,
                GEM_PATH: process.env.GEM_PATH,
                SHELL: process.env.SHELL,
                LC_ALL: process.env.LC_ALL,
                LANG: process.env.LANG,
            };
            const homedirStub = Sinon.stub(os, "homedir").returns(homeDir);

            try {
                process.env.PATH = `${homeDir}/.rbenv/old-shim:/custom/bin`;
                delete process.env.RBENV_ROOT;
                process.env.RBENV_VERSION = "3.3.0";
                process.env.GEM_HOME = `${homeDir}/.gem`;
                process.env.GEM_PATH = `${homeDir}/.gem:path`;
                delete process.env.SHELL;
                delete process.env.LC_ALL;
                delete process.env.LANG;

                const env = getEnhancedEnvironment();
                const pathEntries = env.PATH.split(":");

                assert.strictEqual(env.RBENV_ROOT, `${homeDir}/.rbenv`);
                assert.strictEqual(env.RBENV_VERSION, "3.3.0");
                assert.strictEqual(env.GEM_HOME, `${homeDir}/.gem`);
                assert.strictEqual(env.GEM_PATH, `${homeDir}/.gem:path`);
                assert.strictEqual(env.SHELL, "/bin/zsh");
                assert.strictEqual(env.LC_ALL, "en_US.UTF-8");
                assert.strictEqual(env.LANG, "en_US.UTF-8");
                assert.ok(pathEntries.includes(`${homeDir}/.rbenv/shims`));
                assert.ok(pathEntries.includes(`${homeDir}/.rbenv/bin`));
                assert.ok(pathEntries.includes("/opt/homebrew/bin"));
                assert.ok(pathEntries.includes(`${homeDir}/.rvm/bin`));
                assert.ok(pathEntries.includes("/custom/bin"));
                assert.ok(!pathEntries.includes(`${homeDir}/.rbenv/old-shim`));
            } finally {
                homedirStub.restore();
                for (const [key, value] of Object.entries(originalEnv)) {
                    if (value === undefined) {
                        delete process.env[key];
                    } else {
                        process.env[key] = value;
                    }
                }
            }
        });
    });
});
