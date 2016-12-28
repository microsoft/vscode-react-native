// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as semver from "semver";
import * as fs from "fs";
import * as path from "path";
import {CommandExecutor} from "./commandExecutor";

export class ReactNativeProjectHelper {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    public getReactNativeVersion() {
        return new CommandExecutor(this.projectRoot).getReactNativeVersion();
    }

    /**
     * Ensures that we are in a React Native project
     * Otherwise, displays an error message banner
     */
    public isReactNativeProject(): Q.Promise<boolean> {
        if (!this.projectRoot || !fs.existsSync(path.join(this.projectRoot, "package.json"))) {
            return Q<boolean>(false);
        }
        return this.getReactNativeVersion().
        then(version => {
            return !!(version);
        });
    }

    public validateReactNativeVersion(): Q.Promise<void> {
        return this.getReactNativeVersion().then(version => {
            if (semver.gte(version, "0.19.0")) {
                return Q.resolve<void>(void 0);
            } else {
                return Q.reject<void>(new RangeError(`Project version = ${version}`));
            }
        });
    }
}
