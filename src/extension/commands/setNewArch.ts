// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { FileSystem } from "../../common/node/fileSystem";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { CommandExecutor } from "../../common/commandExecutor";
import { AppLauncher } from "../appLauncher";
import { Command } from "./util/command";

const logger = OutputChannelLogger.getMainChannel();

export class SetNewArch extends Command {
    codeName = "setNewArch";
    label = "Set React Native New Architecture";
    error = ErrorHelper.getInternalError(InternalErrorCode.FaiedToSetNewArch);
    private nodeFileSystem = new FileSystem();

    async baseFn(): Promise<void> {
        assert(this.project);
        const type = await vscode.window.showQuickPick(["Android", "iOS"], {
            placeHolder: "Select type for mobile OS",
        });
        const isNewArchEnabled = await vscode.window.showQuickPick(["true", "false"], {
            placeHolder: "Whether to enable New Architecture",
        });
        const projectRoot = this.project.getPackager().getProjectPath();

        if (type === undefined || isNewArchEnabled === undefined) return;
        if (type === "iOS") {
            const podfilePath = path.join(projectRoot, "ios", "Podfile");
            let podfileContent = fs.readFileSync(podfilePath, "utf-8");

            const nodeModulesRoot: string =
                AppLauncher.getNodeModulesRootByProjectPath(projectRoot);
            const commandExecutor = new CommandExecutor(
                nodeModulesRoot,
                `${projectRoot}/ios`,
                logger,
            );
            if (!projectRoot || !fs.existsSync(podfilePath)) {
                logger.warning("Podfile not found");
                return;
            }
            const editLine = "ENV['RCT_NEW_ARCH_ENABLED'] = '0'";
            if (isNewArchEnabled === "true" && podfileContent.includes(editLine)) {
                const lines = podfileContent.split("\n");
                const filteredLines = lines.filter(line => line.trim() !== editLine);
                podfileContent = filteredLines.join("\n");
                await this.nodeFileSystem.writeFile(podfilePath, podfileContent);
                await commandExecutor.spawn("pod", ["install"]);
            }
            if (isNewArchEnabled === "false") {
                if (!podfileContent.includes(editLine)) {
                    podfileContent = `${editLine}\n${podfileContent}`;
                    await this.nodeFileSystem.writeFile(podfilePath, podfileContent);
                    await commandExecutor.spawn("pod", ["install"]);
                }
            }
        }
        if (type === "Android") {
            const gradleFilePath = path.join(projectRoot, "android", "gradle.properties");
            if (!projectRoot || !fs.existsSync(gradleFilePath)) {
                logger.warning("gradle.properties file not found");
                return;
            }

            const gradleFileContent = fs.readFileSync(gradleFilePath, "utf-8");
            const archMatch = gradleFileContent.match(/newArchEnabled\s*=\s*\w*/);
            if (archMatch && !archMatch[0].startsWith("#")) {
                const updatedHermes = gradleFileContent.replace(
                    /newArchEnabled\s*=\s*\w*/,
                    `newArchEnabled=${isNewArchEnabled}`,
                );
                await this.nodeFileSystem.writeFile(gradleFilePath, updatedHermes);
            } else {
                const updatedGradle = `${gradleFileContent} \nnewArchEnabled=${isNewArchEnabled}`;
                await this.nodeFileSystem.writeFile(gradleFilePath, updatedGradle);
            }
        }
    }
}
