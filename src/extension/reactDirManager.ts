// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as vscode from "vscode";
import * as path from "path";
import {FileSystem} from "../common/node/fileSystem";
import {EntryPoint} from "../common/entryPoint";

/**
 * Manages the lifecycle of the .vscode/.react folder, which hosts the temporary source/map files we need for debugging.
 * We use synchronous operations here because we want to return after the init/cleanup has been done.
 */
export class ReactDirManager implements vscode.Disposable {
    public static ReactDirPath = path.join(vscode.workspace.rootPath, ".vscode", ".react");

    public create(): Q.Promise<void> {
        let fs = new FileSystem();
        /* if the folder exists, remove it, then recreate it */
        return fs.removePathRecursivelyAsync(ReactDirManager.ReactDirPath)
            .then(() =>
                fs.mkDir(ReactDirManager.ReactDirPath));
    }

    public dispose(): void {
        new EntryPoint(vscode.window.createOutputChannel("React-Native")).runFunction("extension.deleteTemporaryFolder",
            "Couldn't delete the temporary folder ${ReactDirManager.ReactDirPath}",
            () =>
                new FileSystem().removePathRecursivelySync(ReactDirManager.ReactDirPath), /*errorsAreFatal*/ true);
    }
}
