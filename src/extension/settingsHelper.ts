// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import path = require("path");
import {ConfigurationReader} from "../common/configurationReader";
import {Packager} from "../common/packager";
import {LogLevel} from "../common/log/logHelper";

export class SettingsHelper {
    public static DEFAULT_IOS_SIMULATOR = "iPhone 5";

    /**
     * Path to the workspace settings file
     */
    public static get settingsJsonPath(): string {
        return path.join(vscode.workspace.rootPath, ".vscode", "settings.json");
    }

    /**
     * Enable javascript intellisense via typescript.
     */
    public static notifyUserToAddTSDKInSettingsJson(tsdkPath: string): void {
        vscode.window.showInformationMessage(`Please make sure you have \"typescript.tsdk\": \"${tsdkPath}\" in .vscode/settings.json and restart VSCode afterwards.`);
    }

    /**
     * Removes javascript intellisense via typescript.
     */
    public static notifyUserToRemoveTSDKFromSettingsJson(tsdkPath: string): void {
        vscode.window.showInformationMessage(`Please remove \"typescript.tsdk\": \"${tsdkPath}\" from .vscode/settings.json and restart VSCode afterwards.`);
    }

    /**
     * Get the path of the Typescript TSDK as it is in the workspace configuration
     */
    public static getTypeScriptTsdk(): string | null {
        const workspaceConfiguration = vscode.workspace.getConfiguration();
        if (workspaceConfiguration.has("typescript.tsdk")) {
            const tsdk = workspaceConfiguration.get("typescript.tsdk");
            if (tsdk) {
                return ConfigurationReader.readString(tsdk);
            }
        }
        return null;
    }

    /**
     * We get the packager port configured by the user
     */
    public static getPackagerPort(): number {
        const workspaceConfiguration = vscode.workspace.getConfiguration();
        if (workspaceConfiguration.has("react-native.packager.port")) {
            return ConfigurationReader.readInt(workspaceConfiguration.get("react-native.packager.port"));
        }
        return Packager.DEFAULT_PORT;
    }

    /**
     * Get showInternalLogs setting
     */
    public static getShowInternalLogs(): boolean {
        const workspaceConfiguration = vscode.workspace.getConfiguration();
        if (workspaceConfiguration.has("react-native-tools.showInternalLogs")) {
            return ConfigurationReader.readBoolean(workspaceConfiguration.get("react-native-tools.showInternalLogs"));
        }
        return false;
    }

    /**
     * Get logLevel setting
     */
    public static getLogLevel(): LogLevel {
        const workspaceConfiguration = vscode.workspace.getConfiguration();
        if (workspaceConfiguration.has("react-native-tools.logLevel")) {
            let logLevelString: string = ConfigurationReader.readString(workspaceConfiguration.get("react-native-tools.logLevel"));
            return <LogLevel>parseInt(LogLevel[<any>logLevelString], 10);
        }
        return LogLevel.None;
    }

    /**
     * Get the React Native project root path
     */
    public static getReactNativeProjectRoot(): string {
        const workspaceConfiguration = vscode.workspace.getConfiguration();
        if (workspaceConfiguration.has("react-native-tools.projectRoot")) {
            let projectRoot: string = ConfigurationReader.readString(workspaceConfiguration.get("react-native-tools.projectRoot"));
            if (path.isAbsolute(projectRoot)) {
                return projectRoot;
            } else {
                return path.resolve(vscode.workspace.rootPath, projectRoot);
            }
        }
        return vscode.workspace.rootPath;
    }

    /**
     * Get application target from settings.json
     */
    public static getApplicationTarget(platform: string, targetType: string): string {
        const workspaceConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const configKey: string = `react-native.${platform}.launchTarget.${targetType}`;
        if (workspaceConfiguration.has(configKey)) {
            return ConfigurationReader.readString(workspaceConfiguration.get(configKey));
        } else if (platform === "ios") {
            return targetType === "simulator" ? SettingsHelper.DEFAULT_IOS_SIMULATOR : "";
        }

        return "";
    }
}
