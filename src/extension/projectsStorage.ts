// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { AppLauncher } from "./appLauncher";

export class ProjectsStorage {
    public static readonly projectsCache: { [key: string]: AppLauncher } = {};

    public static addFolder(workspaceFolder: string, appLauncher: AppLauncher): void {
        this.projectsCache[workspaceFolder.toLowerCase()] = appLauncher;
    }

    public static getFolder(workspaceFolder: vscode.WorkspaceFolder): AppLauncher {
        return this.projectsCache[workspaceFolder.uri.fsPath.toLowerCase()];
    }

    public static delFolder(workspaceFolder: vscode.WorkspaceFolder): void {
        delete this.projectsCache[workspaceFolder.uri.fsPath.toLowerCase()];
    }
}
