// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {FileSystem} from "./node/fileSystem";
import * as vscode from "vscode";
import * as path from "path";

/**
 * Manages the lifecycle of the .vscode/.react folder, which hosts the temporary source/map files we need for debugging.
 * We use synchronous operations here because we want to return after the init/cleanup has been done.
 */
export class ReactDirManager implements vscode.Disposable {
    public static ReactDirPath = path.join(vscode.workspace.rootPath, ".vscode", ".react");

    constructor() {
        let fs = new FileSystem();
        /* if the folder exists, remove it, then recreate it */
        fs.removePathRecursivelyAsync(ReactDirManager.ReactDirPath)
            .done(() => fs.mkDir(ReactDirManager.ReactDirPath));
    }

    public dispose(): void {
        new FileSystem().removePathRecursivelySync(ReactDirManager.ReactDirPath);
    }
}
