// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { ConfigurationReader } from "../common/configurationReader";
import { Packager } from "../common/packager";
import { SystemColorTheme } from "../common/editorColorThemesHelper";
import { LogLevel } from "./log/LogHelper";
import { PackagerStatusIndicator } from "./packagerStatusIndicator";
import stripJsonComments = require("strip-json-comments");

export class SettingsHelper {
    /**
     * We get the packager port configured by the user
     */
    public static getPackagerPort(fsPath: string): number {
        const projectRoot = SettingsHelper.getReactNativeProjectRoot(fsPath);
        const uri = vscode.Uri.file(projectRoot);
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
            const logLevelString: string = ConfigurationReader.readString(
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
        const uri = vscode.Uri.file(fsPath);
        const workspaceConfiguration = vscode.workspace.getConfiguration("react-native-tools", uri);
        if (workspaceConfiguration.has("projectRoot")) {
            const projectRoot: string = ConfigurationReader.readString(
                workspaceConfiguration.get("projectRoot"),
            );
            return path.isAbsolute(projectRoot)
                ? projectRoot
                : path.resolve(uri.fsPath, projectRoot);
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
        const workspaceConfiguration: vscode.WorkspaceConfiguration =
            vscode.workspace.getConfiguration("react-native", uri);
        const configKey = `${platform}.runArguments.${target}`;
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
        const workspaceConfiguration: vscode.WorkspaceConfiguration =
            vscode.workspace.getConfiguration("react-native", uri);
        const configKey = `${platform}.env.${target}`;
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
        const workspaceConfiguration: vscode.WorkspaceConfiguration =
            vscode.workspace.getConfiguration("react-native", uri);
        const configKey = `${platform}.envFile.${target}`;
        if (workspaceConfiguration.has(configKey)) {
            return ConfigurationReader.readString(workspaceConfiguration.get(configKey));
        }

        return "";
    }

    public static getNetworkInspectorConsoleLogsColorTheme(): SystemColorTheme {
        const workspaceConfiguration = vscode.workspace.getConfiguration(
            "react-native-tools.networkInspector",
            null,
        );
        if (workspaceConfiguration.has("consoleLogsColorTheme")) {
            const consoleLogsColorTheme: string = ConfigurationReader.readString(
                workspaceConfiguration.get("consoleLogsColorTheme"),
            );
            return SystemColorTheme[consoleLogsColorTheme];
        }
        return SystemColorTheme.Light;
    }

    /**
     * We get the packager port configured by the user
     */
    public static getPackagerStatusIndicatorPattern(fsPath: string): string {
        const projectRoot = SettingsHelper.getReactNativeProjectRoot(fsPath);
        const uri = vscode.Uri.file(projectRoot);
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
        const workspaceConfiguration: vscode.WorkspaceConfiguration =
            vscode.workspace.getConfiguration("react-native", uri);
        if (workspaceConfiguration.has("android.logCatArguments")) {
            return ConfigurationReader.readArray(
                workspaceConfiguration.get("android.logCatArguments"),
            );
        }
        return undefined;
    }

    public static getExpoDependencyVersion(packageName: string): string | undefined {
        const workspaceConfiguration: vscode.WorkspaceConfiguration =
            vscode.workspace.getConfiguration("react-native.expo.dependencies");
        if (workspaceConfiguration.has(packageName)) {
            const packageVersion = ConfigurationReader.readString(
                workspaceConfiguration.get(packageName),
            );
            return packageVersion;
        }
        return undefined;
    }

    public static getShowTips(): boolean {
        const workspaceConfiguration = vscode.workspace.getConfiguration(
            "react-native-tools",
            null,
        );
        if (workspaceConfiguration.has("showUserTips")) {
            return ConfigurationReader.readBoolean(workspaceConfiguration.get("showUserTips"));
        }
        return false;
    }

    public static async setShowTips(showTips: boolean): Promise<void> {
        const workspaceConfiguration = vscode.workspace.getConfiguration(
            "react-native-tools",
            null,
        );
        if (workspaceConfiguration.has("showUserTips")) {
            await workspaceConfiguration.update("showUserTips", showTips, true);
        }
    }

    public static async getWorkspaceFileExcludeFolder(
        settingsPath: string | undefined,
    ): Promise<any> {
        const workspaceSettingsContent = settingsPath
            ? JSON.parse(stripJsonComments(fs.readFileSync(settingsPath, "utf-8")))
            : null;
        if (workspaceSettingsContent) {
            if (workspaceSettingsContent.settings) {
                const exclude = workspaceSettingsContent.settings["react-native.workspace.exclude"];
                return exclude ? exclude : [];
            }
            return [];
        }
        return [];
    }
}
