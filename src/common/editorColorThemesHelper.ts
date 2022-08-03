// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";

export enum SystemColorTheme {
    Light = "Light",
    Dark = "Dark",
}

export class EditorColorThemesHelper {
    public static isAutoDetectColorSchemeEnabled(): boolean {
        return !!vscode.workspace.getConfiguration("window").get("autoDetectColorScheme");
    }

    public static getCurrentSystemColorTheme(): SystemColorTheme {
        if (EditorColorThemesHelper.isAutoDetectColorSchemeEnabled()) {
            const workbenchConfiguration = vscode.workspace.getConfiguration("workbench");
            const currentTheme = workbenchConfiguration.get("colorTheme");
            const preferredDarkColorTheme = workbenchConfiguration.get("preferredDarkColorTheme");
            return currentTheme === preferredDarkColorTheme
                ? SystemColorTheme.Dark
                : SystemColorTheme.Light;
        }
        throw new Error(
            "Couldn't detect the current system color theme: 'window.autoDetectColorScheme' parameter is disabled",
        );
    }
}
