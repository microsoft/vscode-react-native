// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as fs from "fs";
import * as path from "path";
import * as semver from "semver";
import {URL} from "url";
import {Package} from "./node/package";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalErrorCode} from "../common/error/internalErrorCode";

export interface ParsedPackageName {
    packageName: string;
    isCoercion: boolean;
}

export interface PackageVersion {
    [packageName: string]: string;
}

export class ReactNativeProjectHelper {

    public static getRNVersionsWithBrokenMetroBundler() {
        // https://github.com/Microsoft/vscode-react-native/issues/660 for details
        return ["0.54.0", "0.54.1", "0.54.2", "0.54.3", "0.54.4"];
    }

    public static getReactNativeVersions(
        projectRoot: string,
        parsedPackageNames: ParsedPackageName[] = [ {packageName: "react-native", isCoercion: true} ]
    ): Q.Promise<PackageVersion> {
        return ReactNativeProjectHelper.getReactNativePackageVersionsFromNodeModules(projectRoot, parsedPackageNames)
            .catch(err => {
                return ReactNativeProjectHelper.getReactNativeVersionsFromProjectPackage(projectRoot, parsedPackageNames);
            });
    }

    public static getReactNativePackageVersionsFromNodeModules(
        projectRoot: string,
        parsedPackageNames: ParsedPackageName[] = [ {packageName: "react-native", isCoercion: true} ]
    ): Q.Promise<PackageVersion> {
        let versionPromises: Q.Promise<PackageVersion>[] = [];

        parsedPackageNames.forEach(parsedPackageName => {
            versionPromises.push(
                    new Package(projectRoot).dependencyPackage(parsedPackageName.packageName).version()
                        .then(version => ({[parsedPackageName.packageName]: ReactNativeProjectHelper.processVersion(version, parsedPackageName.isCoercion)}))
                        .catch(err => {
                            throw ErrorHelper.getInternalError(InternalErrorCode.ReactNativePackageIsNotInstalled);
                        })
                );
        });

        return Q.all(versionPromises).then(packageVersions => {
            return packageVersions.reduce((allPackageVersions, packageVersion) => {
                return Object.assign(allPackageVersions, packageVersion);
            }, {});
        });
    }

    public static getReactNativeVersionsFromProjectPackage(
        cwd: string,
        parsedPackageNames: ParsedPackageName[] = [ {packageName: "react-native", isCoercion: true} ]
    ): Q.Promise<PackageVersion> {
        let versionPromises: Q.Promise<PackageVersion>[] = [];

        parsedPackageNames.forEach(parsedPackageName => {
            versionPromises.push((() => {
                const rootProjectPackageJson = new Package(cwd);
                return rootProjectPackageJson.dependencies()
                    .then(dependencies => {
                        if (dependencies[parsedPackageName.packageName]) {
                            return {[parsedPackageName.packageName]: ReactNativeProjectHelper.processVersion(dependencies[parsedPackageName.packageName], parsedPackageName.isCoercion)};
                        }
                        return rootProjectPackageJson.devDependencies()
                            .then(devDependencies => {
                                if (devDependencies[parsedPackageName.packageName]) {
                                    return {[parsedPackageName.packageName]: ReactNativeProjectHelper.processVersion(devDependencies[parsedPackageName.packageName], parsedPackageName.isCoercion)};
                                }
                                return {[parsedPackageName.packageName]: ""};
                            });
                    })
                    .catch(err => {
                        return {[parsedPackageName.packageName]: ""};
                    });
                })()
                );
        });

        return Q.all(versionPromises).then(packageVersions => {
            return packageVersions.reduce((allPackageVersions, packageVersion) => {
                return Object.assign(allPackageVersions, packageVersion);
            }, {});
        });
    }

    public static processVersion(version: string, isCoercion: boolean = true): string {
        try {
            return new URL(version) && "SemverInvalid: URL";
        } catch (err) {
            let versionObj;
            if (isCoercion) {
                versionObj = semver.coerce(version);
            } else {
                versionObj = semver.clean(version, { loose: true });
            }
            return (versionObj && versionObj.toString()) || "SemverInvalid";
        }
    }

    /**
     * Ensures that we are in a React Native project
     * Otherwise, displays an error message banner
     */
    public static isReactNativeProject(projectRoot: string): Q.Promise<boolean> {
        if (!projectRoot || !fs.existsSync(path.join(projectRoot, "package.json"))) {
            return Q<boolean>(false);
        }
        return this.getReactNativeVersions(projectRoot)
            .then(versions => {
                return !!(versions["react-native"]);
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
