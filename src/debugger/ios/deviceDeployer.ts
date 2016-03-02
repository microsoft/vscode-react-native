// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";

import {CommandExecutor} from "../../common/commandExecutor";
import {Xcodeproj} from "../../common/ios/xcodeproj";
import {NestedError} from "../../common/nestedError";

export class DeviceDeployer {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    public deploy(): Q.Promise<void> {
        return new Xcodeproj().findXcodeprojFile(this.projectRoot).then((projectFile: string) => {
            const projectName = path.basename(projectFile, path.extname(projectFile));
            const pathToCompiledApp = path.join(this.projectRoot, "ios", "build",
                "Build", "Products", "Debug-iphoneos", `${projectName}.app`);
            return new CommandExecutor(this.projectRoot)
                .spawnAndWaitForCompletion("ideviceinstaller", ["-i", pathToCompiledApp]).catch((err) => {
                    if ((<any>err).code === "ENOENT") {
                        throw new NestedError("Unable to find ideviceinstaller. Please make sure to install Homebrew (http://brew.sh) and then 'brew install ideviceinstaller'", err);
                    }
                    throw err;
                });
        });
    }
}