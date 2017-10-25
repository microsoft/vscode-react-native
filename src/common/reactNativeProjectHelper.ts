// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as fs from "fs";
import * as path from "path";
import {CommandExecutor} from "./commandExecutor";

export class ReactNativeProjectHelper {
    public static getReactNativeVersion(projectRoot: string) {
        return new CommandExecutor(projectRoot).getReactNativeVersion();
    }

    /**
     * Ensures that we are in a React Native project
     * Otherwise, displays an error message banner
     */
    public static isReactNativeProject(projectRoot: string): Q.Promise<boolean> {
        if (!projectRoot || !fs.existsSync(path.join(projectRoot, "package.json"))) {
            return Q<boolean>(false);
        }
        return this.getReactNativeVersion(projectRoot)
            .then(version => {
                return !!(version);
            });
    }
}
