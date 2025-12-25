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
import { Command } from "./util/command";

const logger = OutputChannelLogger.getMainChannel();

export class EnableExpoHermes extends Command {
    codeName = "expoHermesEnable";
    label = "Enable Expo Hermes";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToEnableExpoHermes);
    private nodeFileSystem = new FileSystem();

    async baseFn(): Promise<void> {
        assert(this.project);
        const platform = await vscode.window.showQuickPick(["Expo", "Android", "iOS"], {
            placeHolder: "Select platform",
        });
        const jsEngine = await vscode.window.showQuickPick(["hermes", "jsc"], {
            placeHolder: "Select JavaScript engine",
        });

        if (!platform || !jsEngine) {
            return;
        }
        const projectRoot = this.project.getPackager().getProjectPath();
        const appJsonPath = path.join(projectRoot, "app.json");
        if (!fs.existsSync(appJsonPath)) {
            logger.warning("app.json not found");
            return;
        }
        const appJson = fs.readFileSync(appJsonPath, "utf-8");
        const regex = new RegExp(
            `"${platform?.toLocaleLowerCase()}":\\s*{[^{}]*"jsEngine":\\s*"[^"]*"`,
        );
        const allMatches = appJson.match(regex);

        if (allMatches) {
            const updatedJsEngine = appJson.replace(
                /"jsEngine":\s*"[^"]*/,
                `"jsEngine": "${jsEngine}`,
            );
            await this.nodeFileSystem.writeFile(appJsonPath, updatedJsEngine);
        } else {
            const appJsonObj = JSON.parse(appJson);
            if (platform === "Expo") {
                appJsonObj.expo.jsEngine = jsEngine;
            } else {
                appJsonObj.expo[platform.toLocaleLowerCase()].jsEngine = jsEngine;
            }
            await this.nodeFileSystem.writeFile(appJsonPath, JSON.stringify(appJsonObj, null, 2));
        }
    }
}
