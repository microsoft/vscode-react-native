// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as semver from "semver";
import {CommandExecutor} from "./commandExecutor";

export class ReactNativeProjectHelper {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    public getReactNativeVersion() {
        return new CommandExecutor(this.workspaceRoot).getReactNativeVersion();
    }

    /**
     * Ensures that we are in a React Native project and then executes the operation
     * Otherwise, displays an error message banner
     * {operation} - a function that performs the expected operation
     */
    public isReactNativeProject(): Q.Promise<boolean> {
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
