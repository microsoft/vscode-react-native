// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";

import {Log} from "../../common/log";
import {Node} from "../../common/node/node";

import {TelemetryHelper} from "../../common/telemetryHelper";

export class Xcodeproj {
    public findXcodeprojFile(projectRoot: string): Q.Promise<string> {
        return new Node.FileSystem()
            .findFilesByExtension(path.join(projectRoot, "ios"), "xcodeproj")
            .then((projectFiles: string[]) => {
                if (projectFiles.length > 1) {
                    TelemetryHelper.sendSimpleEvent("multipleXcodeprojFound");
                    Log.logError(`Warning: more than one xcodeproj found. Using ${projectFiles[0]}`);
                }
                return projectFiles[0];
            });
    }
}