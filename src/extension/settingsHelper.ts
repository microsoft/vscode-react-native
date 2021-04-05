// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as vscode from "vscode";
import * as path from "path";
import { ConfigurationReader } from "../common/configurationReader";
import { Packager } from "../common/packager";
import { LogLevel } from "./log/LogHelper";
import { PackagerStatusIndicator } from "./packagerStatusIndicator";

export class SettingsHelper {
    /**
     * We get the packager port configured by the user
     */
    public static getPackagerPort(fsPath: string): number {
        const projectRoot = SettingsHelper.getReactNativeProjectRoot(fsPath);
        let uri = vscode.Uri.file(projectRoot);
        const workspaceConfiguration = vscode.workspace.getConfiguration(
            "react-native.packager",
            uri,
        );
        if (workspaceConfiguration.has("port")) {
            return ConfigurationReader.readInt(workspaceConfiguration.get("port"));
        }
        return Packager.DEFAULT_PORT;
    }

    /**
     * Get logLevel setting
     */
    public static getLogLevel(): LogLevel {
        // Ideally, we should read this from settings.json but we ignore it for now instead.
        // In future we should support it as well.
        const workspaceConfiguration = vscode.workspace.getConfiguration(
            "react-native-tools",
            null,
        );
        if (workspaceConfiguration.has("logLevel")) {
            let logLevelString: string = ConfigurationReader.readString(
                workspaceConfiguration.get("logLevel"),
            );
            return <LogLevel>parseInt(LogLevel[<any>logLevelString], 10);
        }
        return LogLevel.Info;
    }

    /**
     * Get the React Native project root path
     */
    public static getReactNativeProjectRoot(fsPath: string): string {
        let uri = vscode.Uri.file(fsPath);
        const workspaceConfiguration = vscode.workspace.getConfiguration("react-native-tools", uri);
        if (workspaceConfiguration.has("projectRoot")) {
            let projectRoot: string = ConfigurationReader.readString(
                workspaceConfiguration.get("projectRoot"),
            );
            if (path.isAbsolute(projectRoot)) {
                return projectRoot;
            } else {
                return path.resolve(uri.fsPath, projectRoot);
            }
        }
        return uri.fsPath;
    }

    /**
     * Get the React Native Global Command Name, e.g. 'react-native' or a custom one
     */
    public static getReactNativeGlobalCommandName(uri: vscode.Uri): string | null {
        const workspaceConfiguration = vscode.workspace.getConfiguration("react-native-tools", uri);
        if (workspaceConfiguration.has("reactNativeGlobalCommandName")) {
            return ConfigurationReader.readString(
                workspaceConfiguration.get("reactNativeGlobalCommandName"),
            );
        }

        return null;
    }

    /**
     * Get command line run arguments from settings.json
     */
    public static getRunArgs(
        platform: string,
        target: "device" | "simulator",
        uri: vscode.Uri,
    ): string[] {
        const workspaceConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
            "react-native",
            uri,
        );
        const configKey: string = `${platform}.runArguments.${target}`;
        if (workspaceConfiguration.has(configKey)) {
            return ConfigurationReader.readArray(workspaceConfiguration.get(configKey));
        }

        return [];
    }

    public static getEnvArgs(
        platform: string,
        target: "device" | "simulator",
        uri: vscode.Uri,
    ): any {
        const workspaceConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
            "react-native",
            uri,
        );
        const configKey: string = `${platform}.env.${target}`;
        if (workspaceConfiguration.has(configKey)) {
            return ConfigurationReader.readObject(workspaceConfiguration.get(configKey));
        }

        return {};
    }

    public static getEnvFile(
        platform: string,
        target: "device" | "simulator",
        uri: vscode.Uri,
    ): string {
        const workspaceConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
            "react-native",
            uri,
        );
        const configKey: string = `${platform}.envFile.${target}`;
        if (workspaceConfiguration.has(configKey)) {
            return ConfigurationReader.readString(workspaceConfiguration.get(configKey));
        }

        return "";
    }

    /**
     * We get the packager port configured by the user
     */
    public static getPackagerStatusIndicatorPattern(fsPath: string): string {
        const projectRoot = SettingsHelper.getReactNativeProjectRoot(fsPath);
        let uri = vscode.Uri.file(projectRoot);
        const workspaceConfiguration = vscode.workspace.getConfiguration(
            "react-native.packager",
            uri,
        );
        if (workspaceConfiguration.has("status-indicator")) {
            const version = ConfigurationReader.readString(
                workspaceConfiguration.get("status-indicator"),
            );
            if (
                version === PackagerStatusIndicator.FULL_VERSION ||
                version === PackagerStatusIndicator.SHORT_VERSION
            ) {
                return version;
            }
        }
        return PackagerStatusIndicator.FULL_VERSION;
    }

    public static getLogCatFilteringArgs(uri: vscode.Uri): string[] | undefined {
        const workspaceConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
            "react-native",
            uri,
        );
        if (workspaceConfiguration.has("android.logCatArguments")) {
            return ConfigurationReader.readArray(
                workspaceConfiguration.get("android.logCatArguments"),
            );
        }
        return undefined;
    }
}
