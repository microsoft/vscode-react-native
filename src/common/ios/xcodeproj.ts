// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";

import {FileSystem} from "../../common/node/fileSystem";

export interface IXcodeProjFile {
    fileName: string;
    fileType: string;
    projectName: string;
}

export class Xcodeproj {
    private nodeFileSystem: FileSystem;

    constructor({
        nodeFileSystem = new FileSystem(),
    } = {}) {
        this.nodeFileSystem = nodeFileSystem;
    }

    public findXcodeprojFile(projectRoot: string): Q.Promise<IXcodeProjFile> {
        return this.nodeFileSystem
            .readDir(projectRoot)
            .then((files: string[]): IXcodeProjFile => {
                const sorted = files.sort();
                const candidate = sorted.find((file: string) =>
                    [".xcodeproj", ".xcworkspace"].indexOf(path.extname(file)) !== -1
                );
                if (!candidate) {
                    throw new Error("Unable to find any xcodeproj or xcworkspace files.");
                }

                const fileName = path.join(projectRoot, candidate);
                const fileType = path.extname(candidate);
                const projectName = path.basename(candidate, fileType);
                return {
                    fileName,
                    fileType,
                    projectName,
                };
            });
    }
}