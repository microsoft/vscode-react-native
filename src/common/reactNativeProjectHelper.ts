// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as semver from "semver";
import {Package} from "./node/package";

export class ReactNativeProjectHelper {
    private workspaceRoot: string;
    private static REACT_NATIVE_NPM_LIB_NAME = "react-native";

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Ensures that we are in a React Native project and then executes the operation
     * Otherwise, displays an error message banner
     * {operation} - a function that performs the expected operation
     */
    public isReactNativeProject(): Q.Promise<boolean> {
        let currentPackage = new Package(this.workspaceRoot);
        return currentPackage.peerDependencies().then(peerDependencies => {
            return !!(peerDependencies && peerDependencies["react-native"]);
        }).catch((err: Error) => {
            return Q.resolve(false);
        });
    }

    public validateReactNativeVersion(): Q.Promise<void> {
        return new Package(this.workspaceRoot).dependencyPackage(ReactNativeProjectHelper.REACT_NATIVE_NPM_LIB_NAME).version()
            .then(version => {
                if (semver.gte(version, "0.19.0")) {
                    return Q.resolve<void>(void 0);
                } else {
                    return Q.reject<void>(new RangeError(`Project version = ${version}`));
                }
            });
    }
}
