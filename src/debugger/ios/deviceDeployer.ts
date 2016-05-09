// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";

import {CommandExecutor} from "../../common/commandExecutor";
import {Xcodeproj} from "../../common/ios/xcodeproj";
import {ErrorHelper} from "../../common/error/errorHelper";
import {InternalErrorCode} from "../../common/error/internalErrorCode";

export class DeviceDeployer {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    public deploy(): Q.Promise<void> {
        return new Xcodeproj().findXcodeprojFile(this.projectRoot).then((projectFile: string) => {
            const projectName = path.basename(projectFile, path.extname(projectFile));
            const pathToCompiledApp = path.join(this.projectRoot, "build",
                "Build", "Products", "Debug-iphoneos", `${projectName}.app`);
            return new CommandExecutor(this.projectRoot)
                .spawn("ideviceinstaller", ["-i", pathToCompiledApp]).catch((err) => {
                    if ((<any>err).errorCode === InternalErrorCode.CommandFailed && (<any>err).innerError.code === "ENOENT") {
                        throw ErrorHelper.getNestedError(err, InternalErrorCode.IDeviceInstallerNotFound);
                    }
                    throw err;
                });
        });
    }
}