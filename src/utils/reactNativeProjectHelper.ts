// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {Log} from "./commands/log";
import {Package} from "./node/package";

export class ReactNativeProjectHelper {
    private workspaceRoot: string;

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
            return dependencies && dependencies["react-native"];
        }).catch((err: Error) => {
            Log.logMessage("Attempting to read package.json file failed with error: " + err + ". Please make sure that the package.json file exists and is readable.");
            return Q.resolve(false);
        });
    }
}
