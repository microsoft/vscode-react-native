// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as vscode from "vscode";
import * as path from "path";
import {OutputChannelLogger} from "./outputChannelLogger";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {FileSystem} from "../common/node/fileSystem";
import {EntryPointHandler, ProcessType} from "../common/entryPointHandler";

/**
 * Manages the lifecycle of the .vscode/.react folder, which hosts the temporary source/map files we need for debugging.
 * We use synchronous operations here because we want to return after the init/cleanup has been done.
 */
export class ReactDirManager implements vscode.Disposable {
    public static VscodeDirPath = path.join(vscode.workspace.rootPath || "", ".vscode");
    public static ReactDirPath = path.join(ReactDirManager.VscodeDirPath, ".react");

    public setup(): Q.Promise<void> {
        let fs = new FileSystem();
        /* if the folder exists, remove it, then recreate it */
        return fs.removePathRecursivelyAsync(ReactDirManager.ReactDirPath)
            .then(() => {
                if (!fs.existsSync(ReactDirManager.VscodeDirPath)) {
                    return fs.mkDir(ReactDirManager.VscodeDirPath);
                }
                return null;
            }).then(() =>
                fs.mkDir(ReactDirManager.ReactDirPath)
            );
    }

    public dispose(): void {
        new EntryPointHandler(ProcessType.Extension, new OutputChannelLogger(vscode.window.createOutputChannel("React-Native"))).runFunction("extension.deleteTemporaryFolder",
            ErrorHelper.getInternalError(InternalErrorCode.RNTempFolderDeletionFailed, ReactDirManager.ReactDirPath),
            () =>
                new FileSystem().removePathRecursivelySync(ReactDirManager.ReactDirPath));
    }
}
