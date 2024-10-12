// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { Command } from "./util/command";
import { FileSystem } from "../../common/node/fileSystem";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { CommandExecutor } from "../../common/commandExecutor";
import { AppLauncher } from "../appLauncher";

const logger = OutputChannelLogger.getMainChannel();

export class EnableHermes extends Command {
    codeName = "hermesEnable";
    label = "Enable Hermes";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToEnableHermes);
    private nodeFileSystem = new FileSystem();

    async baseFn(): Promise<void> {
        assert(this.project);
        const type = await vscode.window.showQuickPick(["Android", "iOS"], {
            placeHolder: "Select type for mobile OS",
        });
        const isHermesEnabled = await vscode.window.showQuickPick(["true", "false"], {
            placeHolder: "Whether to enable Hermes",
        });
        const projectRoot = this.project.getPackager().getProjectPath();

        if (type === undefined || isHermesEnabled === undefined) return;
        if (type === "iOS") {
            const podfilePath = path.join(projectRoot, "ios", "Podfile");
            if (!projectRoot || !fs.existsSync(podfilePath)) {
                logger.warning("Podfile not found");
                return;
            }

            const podfileContent = fs.readFileSync(podfilePath, "utf-8");
            const hermesMatches = podfileContent.match(/#?\s*:hermes_enabled\s*=>\s*\w*/);
            const regex = /(use_react_native!\s*\([^)]*?)(\n\s*\))/;
            const rnMatches = podfileContent.match(regex);
            const nodeModulesRoot: string =
                AppLauncher.getNodeModulesRootByProjectPath(projectRoot);
            const commandExecutor = new CommandExecutor(
                nodeModulesRoot,
                `${projectRoot}/ios`,
                logger,
            );

            if (hermesMatches && !hermesMatches[0].startsWith("#")) {
                const updatedHermes = podfileContent.replace(
                    /:hermes_enabled\s*=>\s*\w+/,
                    `:hermes_enabled => ${isHermesEnabled}`,
                );
                await this.nodeFileSystem.writeFile(podfilePath, updatedHermes);
                await commandExecutor.spawn("pod", ["install"]);
            } else {
                if (rnMatches) {
                    let content = rnMatches[1];
                    const closing = rnMatches[2];

                    if (!content.trim().endsWith(",")) {
                        content += ",";
                    }
                    content += `\n    :hermes_enabled => ${isHermesEnabled}`;
                    const newData = podfileContent.replace(regex, content + closing);
                    await this.nodeFileSystem.writeFile(podfilePath, newData);
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
            const hermesMatches = gradleFileContent.match(/hermesEnabled\s*=\s*\w*/);
            if (hermesMatches && !hermesMatches[0].startsWith("#")) {
                const updatedHermes = gradleFileContent.replace(
                    /hermesEnabled\s*=\s*\w*/,
                    `hermesEnabled=${isHermesEnabled}`,
                );
                await this.nodeFileSystem.writeFile(gradleFilePath, updatedHermes);
            } else {
                const updatedGradle = `${gradleFileContent} \nhermesEnabled=${isHermesEnabled}`;
                await this.nodeFileSystem.writeFile(gradleFilePath, updatedGradle);
            }
        }
    }
}
