// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ReactNativeCommand } from "./util/reactNativeCommand";

export class runEasBuild extends ReactNativeCommand {
    codeName = "runEasBuild";
    label = "Run EAS Build";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRunEasBuild);
    async baseFn(): Promise<void> {
        console.log("this.project:", this.project);

        assert(this.project);
        const packager = await this.project.getPackager();
        const projectRootPath = await packager.getProjectPath();

        if (!projectRootPath) {
            void vscode.window.showErrorMessage(
                "Project root directory not found. Please make sure a React Native project is open.",
            );
            return;
        }

        const easJsonPath = path.join(projectRootPath, "eas.json");
        const workflowFolderPath = path.join(projectRootPath, ".eas", "workflows");
        const workflowFilePath = path.join(workflowFolderPath, "create-production-builds.yml");

        try {
            if (!fs.existsSync(easJsonPath)) {
                fs.writeFileSync(easJsonPath, "{}", "utf8");
            }
        } catch (err) {
            void vscode.window.showErrorMessage(
                "Failed. Please check your permissions or disk status.",
            );
            return;
        }
        try {
            if (!fs.existsSync(workflowFilePath)) {
                fs.mkdirSync(workflowFolderPath, { recursive: true });

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

                fs.writeFileSync(workflowFilePath, workflowContent, "utf8");
            }
        } catch (err) {
            void vscode.window.showErrorMessage(
                "Failed. Please check your permissions or disk status.",
            );
            return;
        }
    }
}
