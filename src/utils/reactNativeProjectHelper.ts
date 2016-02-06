// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {Package} from "./node/package";
import * as vscode from "vscode";

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
            return Q.resolve(false);
        });
    }
}
