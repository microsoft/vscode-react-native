// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";

import {ErrorHelper} from "../../common/error/errorHelper";
import {Log} from "../../common/log/log";
import {FileSystem} from "../../common/node/fileSystem";

import {TelemetryHelper} from "../../common/telemetryHelper";

export class Xcodeproj {
    private nodeFileSystem: FileSystem;

    constructor({
        nodeFileSystem = new FileSystem(),
    } = {}) {
        this.nodeFileSystem = nodeFileSystem;
    }

    public findXcodeprojFile(projectRoot: string): Q.Promise<string> {
        return this.nodeFileSystem
            .findFilesByExtension(path.join(projectRoot), "xcodeproj")
            .then((projectFiles: string[]) => {
                if (projectFiles.length > 1) {
                    TelemetryHelper.sendSimpleEvent("multipleXcodeprojFound");
                    Log.logWarning(ErrorHelper.getWarning(`More than one xcodeproj found. Using ${projectFiles[0]}`));
                }
                return projectFiles[0];
            });
    }
}