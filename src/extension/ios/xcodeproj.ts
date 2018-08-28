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
                const extensions = [".xcworkspace", ".xcodeproj"];
                const sorted = files.sort();
                const candidates = sorted.filter((file: string) =>
                    extensions.indexOf(path.extname(file)) !== -1
                ).sort((a, b) =>
                    extensions.indexOf(path.extname(a)) - extensions.indexOf(path.extname(b))
                );

                if (candidates.length === 0) {
                    throw new Error("Unable to find any xcodeproj or xcworkspace files.");
                }

                const bestCandidate = candidates[0];

                const fileName = path.join(projectRoot, bestCandidate);
                const fileType = path.extname(bestCandidate);
                const projectName = path.basename(bestCandidate, fileType);
                return {
                    fileName,
                    fileType,
                    projectName,
                };
            });
    }
}
