// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import path = require("path");
import {ConfigurationReader} from "../common/configurationReader";
import {Packager} from "../common/packager";
import {LogLevel} from "./log/LogHelper";

export class SettingsHelper {
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
    public static getPackagerPort(filePath: string): number {
        let uri = vscode.Uri.file(filePath);
        const workspaceConfiguration = vscode.workspace.getConfiguration("react-native.packager", uri);
        if (workspaceConfiguration.has("port")) {
            return ConfigurationReader.readInt(workspaceConfiguration.get("port"));
        }
        return Packager.DEFAULT_PORT;
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
        return LogLevel.Info;
    }

    /**
     * Get the React Native project root path
     */
    public static getReactNativeProjectRoot(uri: vscode.Uri): string {
        const workspaceConfiguration = vscode.workspace.getConfiguration("react-native-tools", uri);
        if (workspaceConfiguration.has("projectRoot")) {
            let projectRoot: string = ConfigurationReader.readString(workspaceConfiguration.get("react-native-tools.projectRoot"));
            if (path.isAbsolute(projectRoot)) {
                return projectRoot;
            } else {
                return path.resolve(uri.path, projectRoot);
            }
        }
        return uri.path;
    }

    /**
     * Get command line run arguments from settings.json
     */
    public static getRunArgs(platform: string, target: "device" | "simulator"): string[] {
        const workspaceConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const configKey: string = `react-native.${platform}.runArguments.${target}`;
        if (workspaceConfiguration.has(configKey)) {
            return ConfigurationReader.readArray(workspaceConfiguration.get(configKey));
        }

        return [];
    }
}
