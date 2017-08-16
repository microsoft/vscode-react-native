// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {CommandExecutor} from "./commandExecutor";
import {ISpawnResult} from "./node/childProcess";

export interface IReactNative {
    runAndroid(projectRoot: string, variant?: string, deviceId?: string): ISpawnResult;
    createProject(projectRoot: string, projectName: string): Q.Promise<void>;
}

export class ReactNative implements IReactNative {
    public runAndroid(projectRoot: string, variant?: string, target?: string): ISpawnResult {
        let cexec = new CommandExecutor(projectRoot);
        let args: string[] = [];
        if (variant) {
            args.push(`--variant=${variant}`);
        }
        if (target) {
            args.push(`--deviceId=${target}`);
        }
        return cexec.spawnReactCommand("run-android", args);
    }

    public createProject(projectRoot: string, projectName: string): Q.Promise<void> {
        throw new Error("Not yet implemented: ReactNative.createProject");
    }
}
