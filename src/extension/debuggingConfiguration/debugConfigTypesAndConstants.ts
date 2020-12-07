// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { PlatformType } from "../launchArgs";
import { ILaunchRequestArgs } from "../../debugger/debugSessionBase";
import * as vscode from "vscode";

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

export const platformTypePickConfig: DebugConfigurationQuickPickItem[] = [
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
