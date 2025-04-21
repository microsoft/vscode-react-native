// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { PlatformType } from "../launchArgs";
import { ILaunchRequestArgs } from "../../debugger/debugSessionBase";
import { IWDPHelper } from "../../debugger/direct/IWDPHelper";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export interface DebugConfigurationState {
    config: Partial<ILaunchRequestArgs>;
    scenarioType: DebugScenarioType;
    folder?: vscode.WorkspaceFolder;
    token?: vscode.CancellationToken;
}

export type DebugConfigurationQuickPickItem = vscode.QuickPickItem & { type: string };

export enum DebugScenarioType {
    RunApp = "runapp",
    DebugApp = "debugapp",
    AttachApp = "attachapp",
}

export const DEBUG_TYPES = {
    REACT_NATIVE: "reactnative",
    REACT_NATIVE_DIRECT: "reactnativedirect",
};

export enum BROWSER_TYPES {
    Chrome = "chrome",
    Edge = "edge",
}

export const platformTypeRunPickConfig: DebugConfigurationQuickPickItem[] = [
    {
        label: "Android",
        type: PlatformType.Android,
    },
    {
        label: "iOS",
        type: PlatformType.iOS,
    },
    {
        label: "MacOS",
        type: PlatformType.macOS,
    },
    {
        label: "Windows",
        type: PlatformType.Windows,
    },
    {
        label: "ExpoWeb",
        type: PlatformType.ExpoWeb,
    },
    {
        label: "Exponent",
        type: PlatformType.Exponent,
    },
];

export const platformTypeDebugPickConfig: DebugConfigurationQuickPickItem[] = [
    ...platformTypeRunPickConfig,
];

export const platformTypeDirectPickConfig: DebugConfigurationQuickPickItem[] = [
    {
        label: "Hermes engine",
        type: "",
    },
    {
        label: "Direct iOS - Experimental",
        type: PlatformType.iOS,
    },
];

export const appTypePickConfig: DebugConfigurationQuickPickItem[] = [
    {
        label: "Application in direct mode(Hermes)",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
    },
    {
        label: "Classic application",
        type: DEBUG_TYPES.REACT_NATIVE,
    },
];

export const browserTypePickConfig: DebugConfigurationQuickPickItem[] = [
    {
        label: "Chrome",
        type: BROWSER_TYPES.Chrome,
    },
    {
        label: "Edge",
        type: BROWSER_TYPES.Edge,
    },
];

export const shouldUseHermesEngine: DebugConfigurationQuickPickItem[] = [
    {
        label: "Yes",
        type: "yes",
    },
    {
        label: "No",
        type: "no",
    },
];

export const expoPlatform: DebugConfigurationQuickPickItem[] = [
    {
        label: "Android",
        type: PlatformType.Android,
    },
    {
        label: "iOS",
        type: PlatformType.iOS,
    },
];

export const expoHostTypePickConfig: DebugConfigurationQuickPickItem[] = [
    {
        label: "Tunnel",
        description: localize(
            "expoHostTypeTunnel",
            "Allows to deploy and debug an application by means of Expo cloud services",
        ),
        type: "tunnel",
    },
    {
        label: "LAN",
        description: localize(
            "expoHostTypeLAN",
            "Allows to deploy and install an application via your LAN",
        ),
        type: "lan",
    },
    {
        label: "Local",
        description: localize(
            "expoHostTypeLocal",
            "Allows to debug an application on an emulator or an Android device without network connection",
        ),
        type: "local",
    },
];

export const DEBUG_CONFIGURATION_NAMES = {
    ATTACH_TO_HERMES_APPLICATION: "Attach to Hermes application",
    ATTACH_TO_DIRECT_IOS_EXPERIMENTAL: "Attach to Direct iOS - Experimental",
    ATTACH_TO_PACKAGER: "Attach to packager",
    DEBUG_ANDROID: "Debug Android",
    DEBUG_IOS: "Debug iOS",
    DEBUG_WINDOWS: "Debug Windows",
    DEBUG_MACOS: "Debug macOS",
    DEBUG_IN_EXPONENT: "Debug in Exponent",
    DEBUG_ANDROID_HERMES: "Debug Android Hermes",
    DEBUG_DIRECT_IOS_EXPERIMENTAL: "Debug Direct iOS - Experimental",
    DEBUG_IOS_HERMES: "Debug iOS Hermes",
    DEBUG_MACOS_HERMES_EXPERIMENTAL: "Debug macOS Hermes - Experimental",
    DEBUG_WINDOWS_HERMES_EXPERIMENTAL: "Debug Windows Hermes - Experimental",
    RUN_ANDROID: "Run Android",
    RUN_IOS: "Run iOS",
    RUN_ANDROID_HERMES: "Run Android Hermes",
    RUN_IOS_HERMES: "Run iOS Hermes",
    RUN_DIRECT_IOS_EXPERIMENTAL: "Run Direct iOS - Experimental",
    DEBUG_IN_EXPONENT_HERMES_EXPERIMENTAL: "Debug in Hermes Exponent - Experimental",
    DEBUG_IN_EXPONENT_WEB_EXPERIMENTAL: "Debug in Exponent Web - Experimental",
};

export const debugConfigurations: Record<string, vscode.DebugConfiguration> = {
    [DEBUG_CONFIGURATION_NAMES.ATTACH_TO_HERMES_APPLICATION]: {
        name: DEBUG_CONFIGURATION_NAMES.ATTACH_TO_HERMES_APPLICATION,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "attach",
    },
    [DEBUG_CONFIGURATION_NAMES.ATTACH_TO_DIRECT_IOS_EXPERIMENTAL]: {
        name: DEBUG_CONFIGURATION_NAMES.ATTACH_TO_DIRECT_IOS_EXPERIMENTAL,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "attach",
        platform: PlatformType.iOS,
        useHermesEngine: false,
        port: IWDPHelper.iOS_WEBKIT_DEBUG_PROXY_DEFAULT_PORT, // 9221
    },
    [DEBUG_CONFIGURATION_NAMES.ATTACH_TO_PACKAGER]: {
        name: DEBUG_CONFIGURATION_NAMES.ATTACH_TO_PACKAGER,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE,
        request: "attach",
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE,
        request: "launch",
        platform: PlatformType.Android,
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_IOS]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_IOS,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE,
        request: "launch",
        platform: PlatformType.iOS,
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE,
        request: "launch",
        platform: PlatformType.Windows,
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE,
        request: "launch",
        platform: PlatformType.macOS,
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_IN_EXPONENT]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_IN_EXPONENT,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE,
        request: "launch",
        platform: PlatformType.Exponent,
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID_HERMES]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID_HERMES,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "launch",
        platform: PlatformType.Android,
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_DIRECT_IOS_EXPERIMENTAL]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_DIRECT_IOS_EXPERIMENTAL,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "launch",
        platform: PlatformType.iOS,
        useHermesEngine: false,
        target: "device",
        port: IWDPHelper.iOS_WEBKIT_DEBUG_PROXY_DEFAULT_PORT, // 9221
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_IOS_HERMES]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_IOS_HERMES,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "launch",
        platform: PlatformType.iOS,
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS_HERMES_EXPERIMENTAL]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS_HERMES_EXPERIMENTAL,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "launch",
        platform: PlatformType.macOS,
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS_HERMES_EXPERIMENTAL]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS_HERMES_EXPERIMENTAL,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "launch",
        platform: PlatformType.Windows,
    },
    [DEBUG_CONFIGURATION_NAMES.RUN_ANDROID]: {
        name: DEBUG_CONFIGURATION_NAMES.RUN_ANDROID,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE,
        request: "launch",
        platform: PlatformType.Android,
        enableDebug: false,
    },
    [DEBUG_CONFIGURATION_NAMES.RUN_IOS]: {
        name: DEBUG_CONFIGURATION_NAMES.RUN_IOS,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE,
        request: "launch",
        platform: PlatformType.iOS,
        enableDebug: false,
    },
    [DEBUG_CONFIGURATION_NAMES.RUN_ANDROID_HERMES]: {
        name: DEBUG_CONFIGURATION_NAMES.RUN_ANDROID_HERMES,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "launch",
        platform: PlatformType.Android,
        enableDebug: false,
    },
    [DEBUG_CONFIGURATION_NAMES.RUN_IOS_HERMES]: {
        name: DEBUG_CONFIGURATION_NAMES.RUN_IOS_HERMES,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "launch",
        platform: PlatformType.iOS,
        enableDebug: false,
    },
    [DEBUG_CONFIGURATION_NAMES.RUN_DIRECT_IOS_EXPERIMENTAL]: {
        name: DEBUG_CONFIGURATION_NAMES.RUN_DIRECT_IOS_EXPERIMENTAL,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "launch",
        platform: PlatformType.iOS,
        enableDebug: false,
        useHermesEngine: false,
        target: "device",
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_IN_EXPONENT_HERMES_EXPERIMENTAL]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_IN_EXPONENT_HERMES_EXPERIMENTAL,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "launch",
        platform: PlatformType.Exponent,
    },
    [DEBUG_CONFIGURATION_NAMES.DEBUG_IN_EXPONENT_WEB_EXPERIMENTAL]: {
        name: DEBUG_CONFIGURATION_NAMES.DEBUG_IN_EXPONENT_WEB_EXPERIMENTAL,
        cwd: "${workspaceFolder}",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
        request: "launch",
        platform: PlatformType.ExpoWeb,
    },
};
