// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import path = require("path");
import {ConfigurationReader} from "../common/configurationReader";
import {Packager} from "../common/packager";
import {LogLevel} from "./log/LogHelper";

export class SettingsHelper {
    /**
     * We get the packager port configured by the user
     */
    public static getPackagerPort(fsPath: string): number {
        const projectRoot = SettingsHelper.getReactNativeProjectRoot(fsPath);
        let uri = vscode.Uri.file(projectRoot);
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
    public static getReactNativeProjectRoot(fsPath: string): string {
        const uri = vscode.Uri.file(fsPath);
        const workspaceFolder = <vscode.WorkspaceFolder>vscode.workspace.getWorkspaceFolder(uri);
        const workspaceConfiguration = vscode.workspace.getConfiguration("react-native-tools", uri);
        if (workspaceConfiguration.has("projectRoot")) {
            let projectRoot: string = ConfigurationReader.readString(workspaceConfiguration.get("projectRoot"));
            if (path.isAbsolute(projectRoot)) {
                return projectRoot;
            } else {
                return path.resolve(workspaceFolder.uri.fsPath, projectRoot);
            }
        }
        return workspaceFolder.uri.fsPath;
    }

    /**
     * Get command line run arguments from settings.json
     */
    public static getRunArgs(platform: string, target: "device" | "simulator", uri: vscode.Uri): string[] {
        const workspaceConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("react-native", uri);
        const configKey: string = `${platform}.runArguments.${target}`;
        if (workspaceConfiguration.has(configKey)) {
            return ConfigurationReader.readArray(workspaceConfiguration.get(configKey));
        }

        return [];
    }

    public static getEnvArgs(platform: string, target: "device" | "simulator", uri: vscode.Uri): any {
        const workspaceConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("react-native", uri);
        const configKey: string = `${platform}.env.${target}`;
        if (workspaceConfiguration.has(configKey)) {
            return ConfigurationReader.readObject(workspaceConfiguration.get(configKey));
        }

        return {};
    }

    public static getEnvFile(platform: string, target: "device" | "simulator", uri: vscode.Uri): string {
        const workspaceConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("react-native", uri);
        const configKey: string = `${platform}.envFile.${target}`;
        if (workspaceConfiguration.has(configKey)) {
            return ConfigurationReader.readString(workspaceConfiguration.get(configKey));
        }

        return "";
    }
}
