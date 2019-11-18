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
    useSemverCoerce: boolean;
}

export interface PackageVersion {
    [packageName: string]: string;
}

export interface RNPackageVersions {
    reactNativeVersion: string;
    reactNativeWindowsVersion: string;
}

export class ReactNativeProjectHelper {

    public static getRNVersionsWithBrokenMetroBundler() {
        // https://github.com/Microsoft/vscode-react-native/issues/660 for details
        return ["0.54.0", "0.54.1", "0.54.2", "0.54.3", "0.54.4"];
    }

    public static getReactNativeVersions(projectRoot: string, isRNWindows: boolean = false): Q.Promise<RNPackageVersions> {
        return ReactNativeProjectHelper.getReactNativePackageVersionsFromNodeModules(projectRoot, isRNWindows)
            .catch(err => {
                return ReactNativeProjectHelper.getReactNativeVersionsFromProjectPackage(projectRoot, isRNWindows);
            });
    }

    public static getReactNativePackageVersionsFromNodeModules(projectRoot: string, isRNWindows: boolean = false): Q.Promise<RNPackageVersions> {
        let parsedPackageNames: ParsedPackageName[] = [
            {
                packageName: "react-native",
                useSemverCoerce: true,
            },
        ];

        if (isRNWindows) {
            parsedPackageNames.push({
                packageName: "react-native-windows",
                useSemverCoerce: false,
            });
        }

        let versionPromises: Q.Promise<PackageVersion>[] = [];

        parsedPackageNames.forEach(parsedPackageName => {
            versionPromises.push(
                ReactNativeProjectHelper.getReactNativePackageVersionFromNodeModules(projectRoot, parsedPackageName)
            );
        });

        return Q.all(versionPromises).then(packageVersionArray => {
            return packageVersionArray.reduce((allPackageVersions, packageVersion) => {
                return Object.assign(allPackageVersions, packageVersion);
            }, {});
        })
        .then(packageVersions => {
            if (!packageVersions["react-native"]) {
                throw ErrorHelper.getInternalError(InternalErrorCode.ReactNativePackageIsNotInstalled);
            }
            return {
                reactNativeVersion: packageVersions["react-native"],
                reactNativeWindowsVersion: packageVersions["react-native-windows"] || "",
            };
        });
    }

    public static getReactNativeVersionsFromProjectPackage(cwd: string, isRNWindows: boolean = false): Q.Promise<RNPackageVersions> {
        let parsedPackageNames: ParsedPackageName[] = [
            {
                packageName: "react-native",
                useSemverCoerce: true,
            },
        ];

        if (isRNWindows) {
            parsedPackageNames.push({
                packageName: "react-native-windows",
                useSemverCoerce: false,
            });
        }

        const rootProjectPackageJson = new Package(cwd);

        return rootProjectPackageJson.dependencies()
            .then(dependencies => {
                return rootProjectPackageJson.devDependencies()
                    .then(devDependencies => {
                        let parsedPackageVersions: PackageVersion = {};

                        parsedPackageNames.forEach(parsedPackageName => {
                            try {
                                if (dependencies[parsedPackageName.packageName]) {
                                    parsedPackageVersions[parsedPackageName.packageName] = ReactNativeProjectHelper.processVersion(dependencies[parsedPackageName.packageName], parsedPackageName.useSemverCoerce);
                                } else if (devDependencies[parsedPackageName.packageName]) {
                                    parsedPackageVersions[parsedPackageName.packageName] = ReactNativeProjectHelper.processVersion(devDependencies[parsedPackageName.packageName], parsedPackageName.useSemverCoerce);
                                } else {
                                    parsedPackageVersions[parsedPackageName.packageName] = "";
                                }
                            } catch (err) {
                                parsedPackageVersions[parsedPackageName.packageName] = "";
                            }
                        });

                        return {
                            reactNativeVersion: parsedPackageVersions["react-native"],
                            reactNativeWindowsVersion: parsedPackageVersions["react-native-windows"] || "",
                        };
                    });
            });
    }

    public static processVersion(version: string, useSemverCoerce: boolean = true): string {
        try {
            return new URL(version) && "SemverInvalid: URL";
        } catch (err) {
            let versionObj;
            // As some of 'react-native-windows' versions contain postfixes we cannot use 'coerce' function to parse them
            // as some critical parts of the version string will be dropped. To save this information we use 'clean' function
            if (useSemverCoerce) {
                versionObj = semver.coerce(version);
            } else {
                versionObj = semver.clean(version.replace(/[\^~<>]/g, ""), { loose: true });
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
                return !!(versions.reactNativeVersion);
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

    private static getReactNativePackageVersionFromNodeModules(projectRoot: string, parsedPackageName: ParsedPackageName): Q.Promise<PackageVersion> {
        return new Package(projectRoot).getPackageVersionFromNodeModules(parsedPackageName.packageName)
            .then(version => ({[parsedPackageName.packageName]: ReactNativeProjectHelper.processVersion(version, parsedPackageName.useSemverCoerce)}))
            .catch(err => ({[parsedPackageName.packageName]: ""}));
    }
}
