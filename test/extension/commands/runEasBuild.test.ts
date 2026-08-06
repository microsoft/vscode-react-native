// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as path from "path";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("runEasBuildCommand", function () {
    const projectRootPath = "testProject";
    const projectRootMissingMessage =
        "Project root directory not found. Please make sure a React Native project is open.";
    const fileSystemErrorMessage = "Failed. Please check your permissions or disk status.";
    const workflowContent = `name: Create Production Builds
jobs:
  build_android:
    type: build # This job type creates a production build for Android
    params:
      platform: android
  build_ios:
    type: build # This job type creates a production build for iOS
    params:
      platform: ios
`;

    function createCommandModule(
        existsSyncStub = Sinon.stub().returns(true),
        writeFileSyncStub = Sinon.stub(),
        mkdirSyncStub = Sinon.stub(),
        showErrorMessageStub = Sinon.stub(),
    ) {
        class FakeReactNativeCommand {
            public static formInstance(this: new () => any): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/runEasBuild", {
            fs: {
                existsSync: existsSyncStub,
                writeFileSync: writeFileSyncStub,
                mkdirSync: mkdirSyncStub,
            },
            vscode: {
                window: {
                    showErrorMessage: showErrorMessageStub,
                },
            },
            "../../common/error/errorHelper": {
                ErrorHelper: {
                    getInternalError: () => new Error(),
                },
            },
            "../../common/error/internalErrorCode": {
                InternalErrorCode: {
                    FailedToRunEasBuild: 0,
                },
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/runEasBuild");

        return {
            runEasBuild: module.runEasBuild,
            existsSyncStub,
            writeFileSyncStub,
            mkdirSyncStub,
            showErrorMessageStub,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/runEasBuild").runEasBuild,
        rootPath: string | undefined,
    ): Promise<void> {
        const command = commandClass.formInstance();
        (command as any).project = {
            getPackager: () => ({
                getProjectPath: () => rootPath,
            }),
        };

        await command.baseFn();
    }

    test("should show an error and create no files when the project root is missing", async function () {
        const {
            runEasBuild,
            existsSyncStub,
            writeFileSyncStub,
            mkdirSyncStub,
            showErrorMessageStub,
        } = createCommandModule();

        await runCommand(runEasBuild, undefined);

        assert.strictEqual(showErrorMessageStub.calledWithExactly(projectRootMissingMessage), true);
        assert.strictEqual(existsSyncStub.called, false);
        assert.strictEqual(writeFileSyncStub.called, false);
        assert.strictEqual(mkdirSyncStub.called, false);
    });

    test("should not write eas.json when it already exists", async function () {
        const { runEasBuild, writeFileSyncStub } = createCommandModule();

        await runCommand(runEasBuild, projectRootPath);

        assert.strictEqual(
            writeFileSyncStub.calledWith(path.join(projectRootPath, "eas.json")),
            false,
        );
    });

    test("should write an empty eas.json using UTF-8 when it is missing", async function () {
        const existsSyncStub = Sinon.stub();
        existsSyncStub.onFirstCall().returns(false);
        existsSyncStub.onSecondCall().returns(true);
        const { runEasBuild, writeFileSyncStub } = createCommandModule(existsSyncStub);

        await runCommand(runEasBuild, projectRootPath);

        assert.strictEqual(
            writeFileSyncStub.calledWithExactly(
                path.join(projectRootPath, "eas.json"),
                "{}",
                "utf8",
            ),
            true,
        );
    });

    test("should not create or write the workflow when it already exists", async function () {
        const { runEasBuild, writeFileSyncStub, mkdirSyncStub } = createCommandModule();

        await runCommand(runEasBuild, projectRootPath);

        const workflowFilePath = path.join(
            projectRootPath,
            ".eas",
            "workflows",
            "create-production-builds.yml",
        );
        assert.strictEqual(mkdirSyncStub.called, false);
        assert.strictEqual(writeFileSyncStub.calledWith(workflowFilePath), false);
    });

    test("should create the workflow folder and file when the workflow is missing", async function () {
        const existsSyncStub = Sinon.stub();
        existsSyncStub.onFirstCall().returns(true);
        existsSyncStub.onSecondCall().returns(false);
        const { runEasBuild, writeFileSyncStub, mkdirSyncStub } =
            createCommandModule(existsSyncStub);

        await runCommand(runEasBuild, projectRootPath);

        const workflowFolderPath = path.join(projectRootPath, ".eas", "workflows");
        const workflowFilePath = path.join(workflowFolderPath, "create-production-builds.yml");
        assert.strictEqual(
            mkdirSyncStub.calledWithExactly(workflowFolderPath, { recursive: true }),
            true,
        );
        assert.strictEqual(
            writeFileSyncStub.calledWithExactly(workflowFilePath, workflowContent, "utf8"),
            true,
        );
    });

    test("should show an error when writing a file fails", async function () {
        const existsSyncStub = Sinon.stub().returns(false);
        const writeFileSyncStub = Sinon.stub().throws(new Error("permission denied"));
        const { runEasBuild, mkdirSyncStub, showErrorMessageStub } = createCommandModule(
            existsSyncStub,
            writeFileSyncStub,
        );

        await runCommand(runEasBuild, projectRootPath);

        assert.strictEqual(showErrorMessageStub.calledWithExactly(fileSystemErrorMessage), true);
        assert.strictEqual(mkdirSyncStub.called, false);
    });
});
