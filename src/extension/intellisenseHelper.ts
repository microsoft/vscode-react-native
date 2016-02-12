// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {FileSystem} from "../common/node/fileSystem";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import {Node} from "../common/node/node";
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

        TsConfigHelper.allowJs(true)
            .then(function() {
                return TsConfigHelper.addExcludePaths(["node_modules"]);
            })
            .done();

        let reactTypingsSource = path.resolve(__dirname, "..", "..", "ReactTypings");
        let reactTypingsDest = path.resolve(vscode.workspace.rootPath, ".vscode", "typings");
        let fileSystem = new FileSystem();

        fileSystem.copyRecursive(reactTypingsSource, reactTypingsDest)
            .then(function() {
                return IntellisenseHelper.installTypescriptNext();
            })
            .done();
    }

    public static installTypescriptNext(): Q.Promise<void> {
        let typeScriptNextSource = path.resolve(__dirname, "..", "..", "TypescriptNext");
        let typeScriptNextDest = path.resolve(vscode.workspace.rootPath, ".vscode");
        let typeScriptNextLibPath = path.join(typeScriptNextDest, "typescript", "lib");
        let fileSystem: FileSystem = new FileSystem();

        return fileSystem.exists(typeScriptNextLibPath)
            .then(function(exists: boolean) {
                if (!exists) {
                    return fileSystem.copyRecursive(typeScriptNextSource, typeScriptNextDest);
                }
            })
            .then(function() {
                return SettingsHelper.typescriptTsdk(typeScriptNextLibPath);
            });
    }

    public static enableSalsa(): void {
        if (!process.env.VSCODE_TSJS) {
            let setSalsaEnvVariable: string = "";
            if (os.type() === "Darwin") {
                setSalsaEnvVariable = "launchctl setenv VSCODE_TSJS 1";
            } else if (os.type() === "Windows") {
                setSalsaEnvVariable = "setx VSCODE_TSJS 1";
            }

            let childProcess = new Node.ChildProcess();
            childProcess.exec(setSalsaEnvVariable);

            IntellisenseHelper.installTypescriptNext()
                .then(function() {
                    vscode.window.showInformationMessage("Salsa intellisense for VS Code was turned on. Restart to enable it.");
                })
                .done();
        }
    }
}