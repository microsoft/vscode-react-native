// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as fs from "fs";
import * as path from "path";
import {Package} from "./node/package";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalErrorCode} from "../common/error/internalErrorCode";

export class ReactNativeProjectHelper {

    public static getRNVersionsWithBrokenMetroBundler() {
        // https://github.com/Microsoft/vscode-react-native/issues/660 for details
        return ["0.54.0", "0.54.1", "0.54.2", "0.54.3", "0.54.4"];
    }

    public static getReactNativeVersion(projectRoot: string): Q.Promise<string> {
        return ReactNativeProjectHelper.getReactNativePackageVersionFromNodeModules(projectRoot)
            .catch(err => {
                return ReactNativeProjectHelper.getReactNativeVersionFromProjectPackage(projectRoot);
            });
    }

    public static getReactNativePackageVersionFromNodeModules(projectRoot: string): Q.Promise<string> {
        return new Package(projectRoot).dependencyPackage("react-native").version()
            .catch(err => {
                throw ErrorHelper.getInternalError(InternalErrorCode.ReactNativePackageIsNotInstalled);
            });
    }

    public static getReactNativeVersionFromProjectPackage(cwd: string): Q.Promise<string> {
        const rootProjectPackageJson = new Package(cwd);
        return rootProjectPackageJson.dependencies()
            .then(dependencies => {
                if (dependencies["react-native"]) {
                    return dependencies["react-native"];
                }
                return rootProjectPackageJson.devDependencies()
                    .then(devDependencies => {
                        if (devDependencies["react-native"]) {
                            return devDependencies["react-native"];
                        }
                        return "";
                });
            });
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

    public static isHaulProject(projectRoot: string): boolean {
        if (!projectRoot || !fs.existsSync(path.join(projectRoot, "package.json"))) {
            return false;
        }

        const packageJson = require(path.join(projectRoot, "package.json"));
        const haulVersion = packageJson.devDependencies && packageJson.devDependencies.haul;
        return !!haulVersion;
    }
}
