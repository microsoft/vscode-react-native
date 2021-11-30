// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as vscode from "vscode";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { FileSystem } from "../common/node/fileSystem";
import { EntryPointHandler, ProcessType } from "../common/entryPointHandler";
import { OutputChannelLogger } from "./log/OutputChannelLogger";

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

    public async setup(): Promise<void> {
        this.isDisposed = false;
        const fs = new FileSystem();
        /* if the folder exists, remove it, then recreate it */
        await fs.removePathRecursivelyAsync(this.reactDirPath);
        if (!fs.existsSync(this.vscodeDirPath)) {
            await fs.mkDir(this.vscodeDirPath);
        }
        await fs.mkDir(this.reactDirPath);
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
