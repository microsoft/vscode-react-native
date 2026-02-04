// test/extension/commands/installPods.test.ts

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import Sinon = require("sinon");
import * as vscode from "vscode";
import { InstallPods } from "../../../src/extension/commands/installPods";
import { CommandExecutor } from "../../../src/common/commandExecutor";
import { AppLauncher } from "../../../src/extension/appLauncher";
import { OutputChannelLogger } from "../../../src/extension/log/OutputChannelLogger";

suite("installPodsCommand", function () {
    let showWarningMessageStub: Sinon.SinonStub;
    let showErrorMessageStub: Sinon.SinonStub;
    let showInformationMessageStub: Sinon.SinonStub;
    let commandExecutorStub: Sinon.SinonStub;
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

        if (commandExecutorStub) {
            commandExecutorStub.restore();
        }

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
                showErrorMessageStub.calledOnce,
                "Should show error message when ios directory is missing",
            );
            assert.ok(
                showErrorMessageStub.firstCall.args[0].includes("iOS directory"),
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
                showErrorMessageStub.calledOnce,
                "Should show error message when Podfile is missing",
            );
            assert.ok(
                showErrorMessageStub.firstCall.args[0].includes("Podfile"),
                "Error message should mention Podfile",
            );
        });
    });

    suite("Command execution", function () {
        test("should execute pod install successfully", async function () {
            // Skip on non-macOS
            if (!isMac) {
                return;
            }

            // Create ios directory with Podfile
            const iosPath = path.join(tempDir, "ios");
            fs.mkdirSync(iosPath, { recursive: true });
            fs.writeFileSync(path.join(iosPath, "Podfile"), "# Test Podfile");

            const mockProject = createMockProject(tempDir, path.join(tempDir, "node_modules"));
            (installPodsCommand as any).project = mockProject;

            // Stub CommandExecutor.execute to simulate success
            commandExecutorStub = Sinon.stub(CommandExecutor.prototype, "execute").returns(
                Promise.resolve(),
            );

            await installPodsCommand.baseFn();

            assert.ok(
                commandExecutorStub.calledOnce,
                "CommandExecutor.execute should be called once",
            );
            assert.strictEqual(
                commandExecutorStub.firstCall.args[0],
                "pod install",
                "Should execute 'pod install' command",
            );
            assert.deepStrictEqual(
                commandExecutorStub.firstCall.args[1],
                { cwd: iosPath },
                "Should execute in ios directory",
            );
            assert.ok(showInformationMessageStub.calledOnce, "Should show success message");
        });

        test("should handle pod install failure", async function () {
            // Skip on non-macOS
            if (!isMac) {
                return;
            }

            // Create ios directory with Podfile
            const iosPath = path.join(tempDir, "ios");
            fs.mkdirSync(iosPath, { recursive: true });
            fs.writeFileSync(path.join(iosPath, "Podfile"), "# Test Podfile");

            const mockProject = createMockProject(tempDir, path.join(tempDir, "node_modules"));
            (installPodsCommand as any).project = mockProject;

            // Stub CommandExecutor.execute to simulate failure
            const mockError = new Error("pod install failed");
            commandExecutorStub = Sinon.stub(CommandExecutor.prototype, "execute").returns(
                Promise.reject(mockError),
            );

            let thrownError: Error | null = null;
            try {
                await installPodsCommand.baseFn();
            } catch (error) {
                thrownError = error as Error;
            }

            assert.ok(thrownError !== null, "Should throw error on failure");
            assert.ok(loggerErrorStub.called, "Should log error message");
        });
    });

    suite("Error suggestions", function () {
        test("should suggest installing CocoaPods when command not found", async function () {
            // Skip on non-macOS
            if (!isMac) {
                return;
            }

            // Create ios directory with Podfile
            const iosPath = path.join(tempDir, "ios");
            fs.mkdirSync(iosPath, { recursive: true });
            fs.writeFileSync(path.join(iosPath, "Podfile"), "# Test Podfile");

            const mockProject = createMockProject(tempDir, path.join(tempDir, "node_modules"));
            (installPodsCommand as any).project = mockProject;

            // Stub CommandExecutor.execute to simulate "command not found" error
            const mockError = new Error("pod: command not found");
            commandExecutorStub = Sinon.stub(CommandExecutor.prototype, "execute").returns(
                Promise.reject(mockError),
            );

            try {
                await installPodsCommand.baseFn();
            } catch {
                // Expected to throw
            }

            assert.ok(loggerErrorStub.called, "Should log error message");
            const errorLogMessage = loggerErrorStub.firstCall.args[0];
            assert.ok(
                errorLogMessage.includes("gem install cocoapods"),
                "Error message should suggest installing CocoaPods",
            );
        });

        test("should suggest pod repo update on CDN error", async function () {
            // Skip on non-macOS
            if (!isMac) {
                return;
            }

            // Create ios directory with Podfile
            const iosPath = path.join(tempDir, "ios");
            fs.mkdirSync(iosPath, { recursive: true });
            fs.writeFileSync(path.join(iosPath, "Podfile"), "# Test Podfile");

            const mockProject = createMockProject(tempDir, path.join(tempDir, "node_modules"));
            (installPodsCommand as any).project = mockProject;

            // Stub CommandExecutor.execute to simulate CDN error
            const mockError = new Error("CDN: trunk.cocoapods.org connection failed");
            commandExecutorStub = Sinon.stub(CommandExecutor.prototype, "execute").returns(
                Promise.reject(mockError),
            );

            try {
                await installPodsCommand.baseFn();
            } catch {
                // Expected to throw
            }

            assert.ok(loggerErrorStub.called, "Should log error message");
            const errorLogMessage = loggerErrorStub.firstCall.args[0];
            assert.ok(
                errorLogMessage.includes("pod repo update"),
                "Error message should suggest pod repo update",
            );
        });

        test("should suggest xcode-select on Xcode error", async function () {
            // Skip on non-macOS
            if (!isMac) {
                return;
            }

            // Create ios directory with Podfile
            const iosPath = path.join(tempDir, "ios");
            fs.mkdirSync(iosPath, { recursive: true });
            fs.writeFileSync(path.join(iosPath, "Podfile"), "# Test Podfile");

            const mockProject = createMockProject(tempDir, path.join(tempDir, "node_modules"));
            (installPodsCommand as any).project = mockProject;

            // Stub CommandExecutor.execute to simulate Xcode error
            const mockError = new Error("xcrun: error: unable to find utility");
            commandExecutorStub = Sinon.stub(CommandExecutor.prototype, "execute").returns(
                Promise.reject(mockError),
            );

            try {
                await installPodsCommand.baseFn();
            } catch {
                // Expected to throw
            }

            assert.ok(loggerErrorStub.called, "Should log error message");
            const errorLogMessage = loggerErrorStub.firstCall.args[0];
            assert.ok(
                errorLogMessage.includes("xcode-select --install"),
                "Error message should suggest xcode-select --install",
            );
        });

        test("should suggest checking Ruby on Ruby error", async function () {
            // Skip on non-macOS
            if (!isMac) {
                return;
            }

            // Create ios directory with Podfile
            const iosPath = path.join(tempDir, "ios");
            fs.mkdirSync(iosPath, { recursive: true });
            fs.writeFileSync(path.join(iosPath, "Podfile"), "# Test Podfile");

            const mockProject = createMockProject(tempDir, path.join(tempDir, "node_modules"));
            (installPodsCommand as any).project = mockProject;

            // Stub CommandExecutor.execute to simulate Ruby error
            const mockError = new Error("Ruby version mismatch");
            commandExecutorStub = Sinon.stub(CommandExecutor.prototype, "execute").returns(
                Promise.reject(mockError),
            );

            try {
                await installPodsCommand.baseFn();
            } catch {
                // Expected to throw
            }

            assert.ok(loggerErrorStub.called, "Should log error message");
            const errorLogMessage = loggerErrorStub.firstCall.args[0];
            assert.ok(errorLogMessage.includes("Ruby"), "Error message should mention Ruby");
        });

        test("should suggest checking permissions on permission error", async function () {
            // Skip on non-macOS
            if (!isMac) {
                return;
            }

            // Create ios directory with Podfile
            const iosPath = path.join(tempDir, "ios");
            fs.mkdirSync(iosPath, { recursive: true });
            fs.writeFileSync(path.join(iosPath, "Podfile"), "# Test Podfile");

            const mockProject = createMockProject(tempDir, path.join(tempDir, "node_modules"));
            (installPodsCommand as any).project = mockProject;

            // Stub CommandExecutor.execute to simulate permission error
            const mockError = new Error("Permission denied - /usr/local/lib");
            commandExecutorStub = Sinon.stub(CommandExecutor.prototype, "execute").returns(
                Promise.reject(mockError),
            );

            try {
                await installPodsCommand.baseFn();
            } catch {
                // Expected to throw
            }

            assert.ok(loggerErrorStub.called, "Should log error message");
            const errorLogMessage = loggerErrorStub.firstCall.args[0];
            assert.ok(
                errorLogMessage.includes("sudo") || errorLogMessage.includes("permission"),
                "Error message should suggest checking permissions",
            );
        });

        test("should not add suggestion for unknown error", async function () {
            // Skip on non-macOS
            if (!isMac) {
                return;
            }

            // Create ios directory with Podfile
            const iosPath = path.join(tempDir, "ios");
            fs.mkdirSync(iosPath, { recursive: true });
            fs.writeFileSync(path.join(iosPath, "Podfile"), "# Test Podfile");

            const mockProject = createMockProject(tempDir, path.join(tempDir, "node_modules"));
            (installPodsCommand as any).project = mockProject;

            // Stub CommandExecutor.execute to simulate unknown error
            const mockError = new Error("Some unknown error occurred");
            commandExecutorStub = Sinon.stub(CommandExecutor.prototype, "execute").returns(
                Promise.reject(mockError),
            );

            try {
                await installPodsCommand.baseFn();
            } catch {
                // Expected to throw
            }

            assert.ok(loggerErrorStub.called, "Should log error message");
            const errorLogMessage = loggerErrorStub.firstCall.args[0];
            // Should only contain the base error message without additional suggestion
            assert.ok(
                !errorLogMessage.includes("gem install") &&
                    !errorLogMessage.includes("pod repo update") &&
                    !errorLogMessage.includes("xcode-select"),
                "Error message should not contain specific suggestions for unknown error",
            );
        });
    });
});
