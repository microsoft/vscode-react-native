// test/extension/commands/installPods.test.ts

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import Sinon = require("sinon");
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
});
