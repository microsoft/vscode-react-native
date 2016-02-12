// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {FileSystem} from "../common/node/fileSystem";
import * as child_process from "child_process";
import * as os from "os";
import * as path from "path";
import * as Q from "q";
import * as vscode from "vscode";
import {TsConfigHelper} from "./tsconfigHelper";
import {SettingsHelper} from "./settingsHelper";

export class IntellisenseHelper {
    public static setupReactNativeIntellisense(): void {
        if (!process.env.VSCODE_TSJS) {
            vscode.window.showInformationMessage("Turn on Salsa intellisense for VS Code?", "Yes")
                .then(function(result: string) {
                    if (result === "Yes") {
                        IntellisenseHelper.enableSalsa();
                    }
                });
        }

        Q({})
            .then(() => TsConfigHelper.allowJs(true))
            .then(() => TsConfigHelper.addExcludePaths(["node_modules"]))
            .done();

        let reactTypingsSource = path.resolve(__dirname, "..", "..", "ReactTypings");
        let reactTypingsDest = path.resolve(vscode.workspace.rootPath, ".vscode", "typings");
        let fileSystem = new FileSystem();

        Q({})
            .then(() => fileSystem.copyRecursive(reactTypingsSource, reactTypingsDest))
            .then(() => IntellisenseHelper.installTypescriptNext())
            .done();
    }

    public static installTypescriptNext(): Q.Promise<void> {
        let homeDirectory = process.env.HOME || process.env.USERPROFILE;
        let typeScriptNextDest = path.resolve(homeDirectory, ".vscode");
        let typeScriptNextLibPath = path.join(typeScriptNextDest, "node_modules", "typescript", "lib");
        let fileSystem: FileSystem = new FileSystem();

        return fileSystem.exists(typeScriptNextLibPath)
            .then(function(exists: boolean) {
                if (!exists) {
                    return Q.ninvoke(child_process, "exec", `npm install --prefix ${typeScriptNextDest} typescript@next`);
                }
            })
            .then(function() {
                return SettingsHelper.typescriptTsdk(typeScriptNextLibPath);
            });
    }

    public static enableSalsa(): void {
        if (!process.env.VSCODE_TSJS) {
            let setEnvironmentVariableCommand: string = "";
            if (os.type() === "Darwin") {
                setEnvironmentVariableCommand = "launchctl setenv VSCODE_TSJS 1";
            } else if (os.type() === "Windows") {
                setEnvironmentVariableCommand = "setx VSCODE_TSJS 1";
            }

            Q({})
                .then(() => Q.ninvoke(child_process, "exec", setEnvironmentVariableCommand))
                .then(() => IntellisenseHelper.installTypescriptNext())
                .then(() => vscode.window.showInformationMessage("Salsa intellisense for VS Code was turned on. Restart to enable it."))
                .done();
        }
    }
}