// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { randomBytes } from "crypto";
import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { CommandExecutor } from "../../common/commandExecutor";
import { HostPlatform } from "../../common/hostPlatform";
import { AppLauncher } from "../appLauncher";
import { ReactNativeCommand } from "./util/reactNativeCommand";

export class rnDoctor extends ReactNativeCommand {
    codeName = "doctor";
    label = "React Native Doctor";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRunRNDoctor);
    async baseFn(): Promise<void> {
        assert(this.project);
        const projectRootPath = this.project.getPackager().getProjectPath();
        const nodeModulesRoot: string =
            AppLauncher.getNodeModulesRootByProjectPath(projectRootPath);
        const commandExecutor = new CommandExecutor(nodeModulesRoot, projectRootPath);
        const cli = HostPlatform.getNpmCliCommand(commandExecutor.selectReactNativeCLI());
        const taskId = randomBytes(16).toString("hex");
        const task = new vscode.Task(
            { type: "react-native", command: this.codeName, taskId },
            this.project.getWorkspaceFolder(),
            this.label,
            "React Native",
            new vscode.ShellExecution(cli, ["doctor"], { cwd: projectRootPath }),
            [],
        );
        task.presentationOptions = {
            reveal: vscode.TaskRevealKind.Always,
            focus: true,
            panel: vscode.TaskPanelKind.Dedicated,
        };

        const subscriptions: vscode.Disposable[] = [];
        try {
            await new Promise<void>((resolve, reject) => {
                subscriptions.push(
                    vscode.tasks.onDidEndTaskProcess(event => {
                        if (event.execution.task.definition.taskId !== taskId) {
                            return;
                        }
                        if (event.exitCode === 0) {
                            resolve();
                        } else {
                            reject(
                                ErrorHelper.getInternalError(
                                    InternalErrorCode.CommandFailed,
                                    `${cli} doctor`,
                                    event.exitCode,
                                ),
                            );
                        }
                    }),
                    vscode.tasks.onDidEndTask(event => {
                        if (event.execution.task.definition.taskId === taskId) {
                            reject(this.error);
                        }
                    }),
                );
                void vscode.tasks.executeTask(task).then(undefined, reject);
            });
        } finally {
            subscriptions.forEach(subscription => subscription.dispose());
        }
    }
}
