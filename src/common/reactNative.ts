// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {CommandExecutor} from "./commandExecutor";
import {ISpawnResult} from "./node/childProcess";
import {IAndroidRunOptions} from "./launchArgs";

export interface IReactNative {
    runAndroid(runOptions: IAndroidRunOptions): ISpawnResult;
    createProject(projectRoot: string, projectName: string): Q.Promise<void>;
}

export class ReactNative implements IReactNative {
    public runAndroid(runOptions: IAndroidRunOptions): ISpawnResult {
        let cexec = new CommandExecutor(runOptions.projectRoot);
        let args: string[] = [];
        if (runOptions.variant) {
            args.push("--variant", runOptions.variant);
        }
        if (runOptions.target) {
            args.push("--deviceId", runOptions.target);
        }
        if (runOptions.native_folder) {
            args.push("--appFolder", runOptions.native_folder);
        }
        return cexec.spawnReactCommand("run-android", args);
    }

    public createProject(projectRoot: string, projectName: string): Q.Promise<void> {
        throw new Error("Not yet implemented: ReactNative.createProject");
    }
}
