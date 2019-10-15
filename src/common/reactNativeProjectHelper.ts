// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as fs from "fs";
import * as path from "path";
import {CommandExecutor} from "./commandExecutor";
import {Package} from "./node/package";

export class ReactNativeProjectHelper {

    public static getRNVersionsWithBrokenMetroBundler() {
        // https://github.com/Microsoft/vscode-react-native/issues/660 for details
        return ["0.54.0", "0.54.1", "0.54.2", "0.54.3", "0.54.4"];
    }

    public static getReactNativeVersion(projectRoot: string) {
        return new CommandExecutor(projectRoot).getReactNativeVersion();
    }

    public static getReactNativePackageVersionFromNodeModules(reactNativePackageDir: string): Q.Promise<string> {
        let reactNativePackage = new Package(reactNativePackageDir);
        return reactNativePackage.version();
    }

    public static getReactNativeVersionFromProjectPackage(cwd: string): Q.Promise<string> {
        let curPackage = new Package(cwd);
        return curPackage.dependencyPackage("react-native").version()
            .catch(err => {
                return curPackage.dependencies()
                    .then(dependencies => {
                        if (dependencies["react-native"]) {
                            return dependencies["react-native"];
                        }
                        return curPackage.devDependencies()
                            .then(devDependencies => {
                                if (devDependencies["react-native"]) {
                                    return devDependencies["react-native"];
                                }
                                return "";
                        });
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
