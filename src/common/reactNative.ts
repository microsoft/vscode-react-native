// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {CommandExecutor} from "./commandExecutor";
import {ISpawnResult} from "./node/childProcess";

export interface IReactNative {
    runAndroid(projectRoot: string): ISpawnResult;
    createProject(projectRoot: string, projectName: string): Q.Promise<void>;
}

export class ReactNative implements IReactNative {
    public runAndroid(projectRoot: string): ISpawnResult {
        let cexec = new CommandExecutor(projectRoot);
        return cexec.spawnChildReactCommandProcess("run-android");
    }

    public createProject(projectRoot: string, projectName: string): Q.Promise<void> {
        throw new Error("Not yet implemented: ReactNative.createProject");
    }
}