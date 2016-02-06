// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";

import {CommandExecutor} from "../../utils/commands/commandExecutor";
import {Xcodeproj} from "./xcodeproj";

export class Compiler {
    private projectRoot: string;
    private simulator: boolean;

    constructor(projectRoot: string, simulator: boolean) {
        this.projectRoot = projectRoot;
        this.simulator = simulator;
    }

    public compile(): Q.Promise<void> {
        return this.xcodeBuildArguments().then((xcodeArguments: string[]) => {
            return new CommandExecutor(this.projectRoot).spawnAndWaitForCompletion("xcodebuild", xcodeArguments);
        });
    }

    /*
        Return the appropriate arguments for compiling a react native project
    */
    private xcodeBuildArguments(): Q.Promise<string[]> {
        if (this.simulator) {
            return Q.reject<string[]>(new Error("Error: Compiling for simulator; should be using 'react-native run-ios' instead"));
        }
        return new Xcodeproj().findXcodeprojFile(this.projectRoot).then((projectFile: string) => {
            const projectName = path.basename(projectFile, path.extname(projectFile));
            return [
                "-project", path.join(this.projectRoot, "ios", projectFile),
                "-scheme", projectName,
                "-destination", "generic/platform=iOS", // Build for a generic iOS device
                "-derivedDataPath", path.join(this.projectRoot, "ios", "build")
            ];
        });
    }
}