// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { PlatformType, ExpoHostTypes } from "../launchArgs";
import { ILaunchRequestArgs } from "../../debugger/debugSessionBase";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
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
];

export const platformTypeDebugPickConfig: DebugConfigurationQuickPickItem[] = [
    ...platformTypeRunPickConfig,
    {
        label: "Exponent",
        type: PlatformType.Exponent,
    },
];

export const platformTypeDirectPickConfig: DebugConfigurationQuickPickItem[] = [
    {
        label: "Android Hermes - Experimental",
        type: PlatformType.Android,
    },
    {
        label: "Direct iOS - Experimental",
        type: PlatformType.iOS,
    },
];

export const appTypePickConfig: DebugConfigurationQuickPickItem[] = [
    {
        label: "Application in direct mode",
        type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
    },
    {
        label: "Classic application",
        type: DEBUG_TYPES.REACT_NATIVE,
    },
];

export const expoHostTypePickConfig: DebugConfigurationQuickPickItem[] = [
    {
        label: "Tunnel",
        description: localize(
            "expoHostTypeTunnel",
            "Allows to deploy and debug an application by means of Expo cloud services",
        ),
        type: ExpoHostTypes.Tunnel,
    },
    {
        label: "LAN",
        description: localize(
            "expoHostTypeLAN",
            "Allows to deploy and install an application via your LAN",
        ),
        type: ExpoHostTypes.LAN,
    },
    {
        label: "Local",
        description: localize(
            "expoHostTypeLocal",
            "Allows to debug an application on an emulator or an Android device without network connection",
        ),
        type: ExpoHostTypes.Local,
    },
];
