// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as path from "path";
import { OutputChannelLogger } from "./log/OutputChannelLogger";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { FileSystem } from "../common/node/fileSystem";
import { EntryPointHandler, ProcessType } from "../common/entryPointHandler";

/**
 * Manages the lifecycle of the .vscode/.react folder, which hosts the temporary source/map files we need for debugging.
 * We use synchronous operations here because we want to return after the init/cleanup has been done.
 */
export class ReactDirManager implements vscode.Disposable {
    public vscodeDirPath: string;
    public reactDirPath: string;
    public isDisposed: boolean = false;

    constructor(rootPath: string) {
        this.vscodeDirPath = path.join(rootPath || "", ".vscode");
        this.reactDirPath = path.join(this.vscodeDirPath, ".react");
    }

    public setup(): Promise<void> {
        this.isDisposed = false;
        let fs = new FileSystem();
        /* if the folder exists, remove it, then recreate it */
        return fs
            .removePathRecursivelyAsync(this.reactDirPath)
            .then(() => {
                if (!fs.existsSync(this.vscodeDirPath)) {
                    return fs.mkDir(this.vscodeDirPath);
                }
                return void 0;
            })
            .then(() => fs.mkDir(this.reactDirPath));
    }

    public dispose(): void {
        this.isDisposed = true;
        new EntryPointHandler(
            ProcessType.Extension,
            OutputChannelLogger.getMainChannel(),
        ).runFunction(
            "extension.deleteTemporaryFolder",
            ErrorHelper.getInternalError(
                InternalErrorCode.RNTempFolderDeletionFailed,
                this.reactDirPath,
            ),
            () => new FileSystem().removePathRecursivelySync(this.reactDirPath),
        );
    }
}
