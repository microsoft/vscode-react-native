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
    /**
     * Helper method to configure the project for Salsa intellisense. Will prompt
     * the user before taking action.
     */
    public static setupReactNativeIntellisense(): void {
        if (!process.env.VSCODE_TSJS) {
            vscode.window.showInformationMessage("Turn on Salsa intellisense for VS Code?", "Yes")
                .then(function(result: string) {
                    if (result === "Yes") {
                        IntellisenseHelper.enableSalsa();
                        IntellisenseHelper.prepareWorkspace();
                    }
                });
        }

        IntellisenseHelper.prepareWorkspace();
    }

    /**
     * Helper method that does the following to configure the workspace.
     * - Configures the tsconfig.json to allow Salsa to process JavaScript files.
     * - Configures the tsconfig.json to ignore node_modules.
     * - Installs typing files
     * - Installs Typescript
     */
    public static prepareWorkspace() {
        Q({})
            .then(() => TsConfigHelper.allowJs(true))
            .then(() => TsConfigHelper.addExcludePaths(["node_modules"]))
            .done();

        Q({})
            .then(() => IntellisenseHelper.installReactNativeTypings())
            .then(() => IntellisenseHelper.installTypescriptNext())
            .done();
    }

    /**
     * Helper method that install typings for React Native.
     */
    public static installReactNativeTypings(): Q.Promise<void> {
        let reactTypingsSource = path.resolve(__dirname, "..", "..", "ReactTypings");
        let reactTypingsDest = path.resolve(vscode.workspace.rootPath, ".vscode", "typings");
        let fileSystem = new FileSystem();

        return fileSystem.copyRecursive(reactTypingsSource, reactTypingsDest);
    }

    /**
     * Helper method that installs Typescript into a global location.
     */
    public static installTypescriptNext(): Q.Promise<void> {
        let homeDirectory: string = "";
        if (os.type() === "Darwin") {
            homeDirectory = process.env.HOME;
        } else if (os.type() === "Windows") {
            homeDirectory = process.env.USERPROFILE;
        }

        let typeScriptNextDest: string = path.resolve(homeDirectory, ".vscode");
        let typeScriptNextLibPath: string = path.join(typeScriptNextDest, "node_modules", "typescript", "lib");
        let fileSystem: FileSystem = new FileSystem();

        return fileSystem.exists(typeScriptNextLibPath)
            .then(function(exists: boolean) {
                if (!exists) {
                    return Q.nfcall(child_process.exec, `npm install --prefix ${typeScriptNextDest} typescript@next`);
                }
            })
            .then(function() {
                return SettingsHelper.typescriptTsdk(typeScriptNextLibPath);
            });
    }

    /**
     * Helper method that sets the environment variable and informs the user they need to restart
     * in order to enable the Salsa intellisense.
     */
    public static enableSalsa(): void {
        if (!process.env.VSCODE_TSJS) {
            let setEnvironmentVariableCommand: string = "";
            if (os.type() === "Darwin") {
                setEnvironmentVariableCommand = "launchctl setenv VSCODE_TSJS 1";
            } else if (os.type() === "Windows") {
                setEnvironmentVariableCommand = "setx VSCODE_TSJS 1";
            }

            Q({})
                .then(() => Q.nfcall(child_process.exec, setEnvironmentVariableCommand))
                .then(() => vscode.window.showInformationMessage("Salsa intellisense for VS Code was turned on. Restart to enable it."))
                .done();
        }
    }
}