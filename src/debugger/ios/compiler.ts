// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";

import {CommandExecutor} from "../../common/commandExecutor";
import {Xcodeproj} from "../../common/ios/xcodeproj";

export class Compiler {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    public compile(): Q.Promise<void> {
        return this.xcodeBuildArguments().then((xcodeArguments: string[]) => {
            return new CommandExecutor(this.projectRoot).spawn("xcodebuild", xcodeArguments);
        });
    }

    /*
        Return the appropriate arguments for compiling a react native project
    */
    private xcodeBuildArguments(): Q.Promise<string[]> {
        return new Xcodeproj().findXcodeprojFile(this.projectRoot).then((projectFile: string) => {
            const projectName = path.basename(projectFile, path.extname(projectFile));
            return [
                "-project", path.join(this.projectRoot, projectFile),
                "-scheme", projectName,
                "-destination", "generic/platform=iOS", // Build for a generic iOS device
                "-derivedDataPath", path.join(this.projectRoot, "build"),
            ];
        });
    }
}