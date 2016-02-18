// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {Package} from "./node/package";

export class ReactNativeProjectHelper {
    private workspaceRoot: string;
    private REACT_NATIVE_NPM_LIB_NAME = "react-native";

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
        return currentPackage.dependencies().then(dependencies => {
            return !!(dependencies && dependencies["react-native"]);
        }).catch((err: Error) => {
            return Q.resolve(false);
        });
    }

    public validateReactNativeVersion(): Q.Promise<void> {
        return new Package(this.workspaceRoot).dependencyPackage(this.REACT_NATIVE_NPM_LIB_NAME).version().then(version => {
            // TODO-V1: Use semver instead of all this logic
            const components = version.split(".");
            if (components.length >= 2) { // Even though react-native versions have 3 components, we only care about the first 2
                if (components[0] !== "0" || parseInt(components[1], 10) >= 19) {
                    return Q.resolve<void>(void 0);
                } else {
                    return Q.reject<void>(`Only react-native versions 0.19+ are supported. Current installed version = ${version}`);
                }
            }

            return Q.reject<void>(`Couldn't parse the installed version of the react-native package: version = ${version}`);
        });
    }
}
