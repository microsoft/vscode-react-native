// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {FileSystem} from "../common/node/fileSystem";
import * as child_process from "child_process";
import * as os from "os";
import * as path from "path";
import * as Q from "q";
import * as vscode from "vscode";
import {Telemetry} from "../common/telemetry";
import {TelemetryHelper} from "../common/telemetryHelper";
import {TsConfigHelper} from "./tsconfigHelper";
import {SettingsHelper} from "./settingsHelper";

export class IntellisenseHelper {
    /**
     * Helper method that configures the workspace for Salsa intellisense.
     */
    public static setupReactNativeIntellisense(): Q.Promise<void> {
        // Telemetry - Send Salsa Environment setup information
        const tsSalsaEnvSetup = TelemetryHelper.createTelemetryEvent("RNIntellisense");
        TelemetryHelper.addTelemetryEventProperty(tsSalsaEnvSetup, "TsSalsaEnvSetup", !!process.env.VSCODE_TSJS, false);
        Telemetry.send(tsSalsaEnvSetup);

        const configureWorkspace = Q({})
            .then(() => TsConfigHelper.allowJs(true))
            .then(() => TsConfigHelper.addExcludePaths(["node_modules"]))
            .then(() => IntellisenseHelper.installReactNativeTypings());

        // The actions taken in the promise chain below may result in requring a restart.
        const configureTypescript = Q(false)
            .then((isRestartRequired: boolean) => IntellisenseHelper.enableSalsa(isRestartRequired))
            .then((isRestartRequired: boolean) => IntellisenseHelper.installTypescriptNext(isRestartRequired))
            .then((isRestartRequired: boolean) => IntellisenseHelper.configureWorkspaceSettings(isRestartRequired))
            .then((isRestartRequired: boolean) => IntellisenseHelper.warnIfRestartIsRequired(isRestartRequired));

        /* TODO #83: Refactor this code to
            Q.all([enableSalsa(), installTypescript(), configureWorkspace()])
            .then((result) => warnIfRestartIsRequired(result.any((x) => x)))
        */
        return Q.all([configureWorkspace, configureTypescript]).then(() => { });
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
    public static installTypescriptNext(isRestartRequired: boolean): Q.Promise<boolean> {
        let typeScriptNextDest: string = path.resolve(IntellisenseHelper.getUserHomePath(), ".vscode");
        let typeScriptNextLibPath: string = path.join(typeScriptNextDest, "node_modules", "typescript", "lib");
        let fileSystem: FileSystem = new FileSystem();

        return fileSystem.exists(typeScriptNextLibPath)
            .then(function(exists: boolean) {
                if (!exists) {
                    return Q.nfcall(child_process.exec, `npm install --prefix ${typeScriptNextDest} typescript@next`)
                        .then(() => { return true; });
                }

                return isRestartRequired;
            });
    }

    public static getUserHomePath(): string {
        let homeDirectory: string = "";

        if (os.type() === "Darwin") {
            homeDirectory = process.env.HOME;
        } else if (os.type() === "Windows_NT") {
            homeDirectory = process.env.USERPROFILE;
        }

        return homeDirectory;
    }

    public static configureWorkspaceSettings(isRestartRequired: boolean): Q.Promise<boolean> {
        let typeScriptNextDest: string = path.resolve(IntellisenseHelper.getUserHomePath(), ".vscode");
        let typeScriptNextLibPath: string = path.join(typeScriptNextDest, "node_modules", "typescript", "lib");

        return SettingsHelper.getTypescriptTsdk()
            .then((tsdkPath: string) => {
                if (!tsdkPath) {
                    return SettingsHelper.typescriptTsdk(typeScriptNextLibPath)
                        .then(() => { return true; });
                }

                return isRestartRequired;
            });
    }

    public static warnIfRestartIsRequired(isRestartRequired: boolean): Q.Promise<void> {
        if (isRestartRequired) {
            vscode.window.showInformationMessage("React Native intellisense was successfully configured for this project. Restart to enable it.");
        }

        return;
    }

    /**
     * Helper method that sets the environment variable and informs the user they need to restart
     * in order to enable the Salsa intellisense.
     */
    public static enableSalsa(isRestartRequired: boolean): Q.Promise<boolean> {
        if (!process.env.VSCODE_TSJS) {
            let setEnvironmentVariableCommand: string = "";
            if (os.type() === "Darwin") {
                setEnvironmentVariableCommand = "launchctl setenv VSCODE_TSJS 1";
            } else if (os.type() === "Windows") {
                setEnvironmentVariableCommand = "setx VSCODE_TSJS 1";
            }

            return Q({})
                .then(() => Q.nfcall(child_process.exec, setEnvironmentVariableCommand))
                .then(() => { return true; });
        }

        return Q(isRestartRequired);
    }
}