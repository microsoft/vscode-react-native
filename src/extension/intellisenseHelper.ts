// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {FileSystem} from "../common/node/fileSystem";
import * as child_process from "child_process";
import * as os from "os";
import * as path from "path";
import * as Q from "q";
import * as vscode from "vscode";
import * as semver from "semver";
import {Telemetry} from "../common/telemetry";
import {TelemetryHelper} from "../common/telemetryHelper";
import {CommandExecutor} from "../common/commandExecutor";
import {TsConfigHelper} from "./tsconfigHelper";
import {SettingsHelper} from "./settingsHelper";
import {Log, LogLevel} from "../common/log";


interface IInstallProps {
    installed: boolean;
    version: string;
}

export class IntellisenseHelper {

    private static s_typeScriptVersion = "1.8.2";           // preferred version of TypeScript for legacy VSCode installs
    private static s_vsCodeVersion = "0.10.10-insider";     // preferred version of VSCode (current is 0.10.9, 0.10.10-insider+ will include native TypeScript support)
    // note: semver considers "x.x.x-<string>" to be < "x.x.x"" - so we include insider here as the
    //       insider build is less than the release build of 0.10.10 and we will support it.

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
            .then((isRestartRequired: boolean) => IntellisenseHelper.verifyInstallTypeScript(isRestartRequired))
            .then((isRestartRequired: boolean) => IntellisenseHelper.configureWorkspaceSettings(isRestartRequired))
            .then((isRestartRequired: boolean) => IntellisenseHelper.warnIfRestartIsRequired(isRestartRequired))
            .catch((err: any) => {
                Log.logError("Error while setting up IntelliSense: " + err);
                return Q.reject<void>(err);
            });

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
     * Helper method that verifies the correct version of TypeScript is installed.
     * If using a newer version of VSCode TypeScript is installed by default and no
     * action is needed. If using an older version, verify that the correct TS version is
     * installed, if not install it.
     */
    public static verifyInstallTypeScript(isRestartRequired: boolean): Q.Promise<boolean> {

        if (IntellisenseHelper.isSalsaSupported()) {
            // this is the correct version of vscode, which includes TypeScript (Salsa) support, nothing to do here
            return Q.resolve<boolean>(isRestartRequired);
        }

        return IntellisenseHelper.getInstalledTypeScriptVersion()
            .then(function(installProps: IInstallProps) {

                if (installProps.installed === true) {

                    if (semver.neq(IntellisenseHelper.s_typeScriptVersion, installProps.version)) {
                        Log.logInternalMessage(LogLevel.Debug, "TypeScript is installed with the wrong version: " + installProps.version);
                        return true;
                    } else {
                        Log.logInternalMessage(LogLevel.Debug, "Installed TypeScript version is correct");
                        return false;
                    }
                } else {
                    Log.logInternalMessage(LogLevel.Debug, "TypeScript is not installed");
                    return true;
                }
            })
            .then((install: boolean) => {

                if (install) {
                    let installPath: string = path.resolve(IntellisenseHelper.getUserHomePath(), ".vscode");
                    let runArguments: string[] = [];
                    runArguments.push("install");
                    runArguments.push("--prefix " + installPath);
                    runArguments.push("typescript@" + IntellisenseHelper.s_typeScriptVersion);

                    return new CommandExecutor(installPath).spawnAndWaitForCompletion("npm", runArguments)
                        .then(() => {
                            return true;
                        })
                        .catch((err: any) => {
                            Log.logError("Error attempting to install TypeScript: " + err);
                            return Q.reject<boolean>(err);
                        });

                } else {
                    return isRestartRequired;
                }
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
        let typeScriptLibPath: string = path.resolve(IntellisenseHelper.getTypeScriptInstallPath(), "lib");

        return SettingsHelper.getTypeScriptTsdk()
            .then((tsdkPath: string) => {

                if (IntellisenseHelper.isSalsaSupported()) {
                    if (tsdkPath !== null &&
                        tsdkPath === typeScriptLibPath) {
                        // Note: In previous releases of VSCode (< 0.10.10) the Salsa TypeScript
                        // IntelliSense was not enabled by default, this extension would install
                        // Salsa itself, and update the settings to point at that. Here we
                        // attempt to reset that value to null if it still points to the previous
                        // installed (and no longer valid) version of TypeScript.
                        return SettingsHelper.removeTypeScriptTsdk()
                            .then(() => { return true; });
                    }
                } else {
                    if (tsdkPath === null) {
                        return SettingsHelper.setTypeScriptTsdk(typeScriptLibPath)
                            .then(() => { return true; });
                    }
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
            } else if (os.type() === "Windows_NT") {
                setEnvironmentVariableCommand = "setx VSCODE_TSJS 1";
            }

            return Q({})
                .then(() => Q.nfcall(child_process.exec, setEnvironmentVariableCommand))
                .then(() => { return true; });
        }

        return Q(isRestartRequired);
    }

    /**
     * Simple check to see if the TypeScript package is in the expected location (where we installed it)
     */
    private static isTypeScriptInstalled(): Q.Promise<boolean> {
        let fileSystem: FileSystem = new FileSystem();
        let installPath: string = path.join(IntellisenseHelper.getTypeScriptInstallPath(), "lib");
        return fileSystem.exists(installPath);
    }

    /**
     * Checks for the existance of our installed TypeScript package, if it exists also determine its version
     */
    private static getInstalledTypeScriptVersion(): Q.Promise<IInstallProps> {
        return IntellisenseHelper.isTypeScriptInstalled()
            .then((installed: boolean) => {
                let installProps: IInstallProps = {
                    installed: installed,
                    version: ""
                };

                if (installed === true) {
                    Log.logInternalMessage(LogLevel.Debug, "TypeScript is installed - checking version");
                    return IntellisenseHelper.readPackageJson()
                        .then((version: string) => {
                            installProps.version = version;
                            return installProps;
                        });
                } else {
                    return installProps;
                }
            });
    }

    /**
     * Read the package.json from the TypeScript install path and return the version if it's available
     */
    private static readPackageJson(): Q.Promise<string> {
        let packageFilePath: string = path.join(IntellisenseHelper.getTypeScriptInstallPath(), "package.json");
        let fileSystem = new FileSystem();

        return fileSystem.exists(packageFilePath)
            .then(function(exists: boolean): Q.Promise<string> {
                if (!exists) {
                    return Q.reject<string>("package.json not found at:" + packageFilePath);
                }

                return fileSystem.readFile(packageFilePath, "utf-8");
            })
            .then(function(jsonContents: string): Q.Promise<any> {
                let data = JSON.parse(jsonContents);
                return data.version;
            })
            .catch((err: any) => {
                Log.logError("Error while procesing package.json: " + err);
                return "0.0.0";
            });
    }

    /**
     * Simple helper to get the TypeScript install path
     */
    private static getTypeScriptInstallPath(): string {

        let codePath: string = path.resolve(IntellisenseHelper.getUserHomePath(), ".vscode");
        let typeScriptLibPath: string = path.join(codePath, "node_modules", "typescript");
        return typeScriptLibPath;
    }

    /**
     * Simple helper to determine if the current version of VSCode supports TypeScript (Salsa) or better
     */
    private static isSalsaSupported(): boolean {
        return semver.gte(vscode.version, IntellisenseHelper.s_vsCodeVersion, true);
    }
}