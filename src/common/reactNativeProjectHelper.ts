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

export interface ParsedPackage {
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

    private static RN_VERSION_ERRORS = {
        MISSING_PACKAGE_IN_NODE_MODULES: "errorMissingPackageInNodeModules",
        MISSING_DEPENDENCY: "errorMissingDependency",
        MISSING_DEPENDENCIES_FIELDS: "errorMissingDependenciesFields",
        UNKNOWN_ERROR: "errorUnknown",
    };

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
        let parsedPackages: ParsedPackage[] = [
            {
                packageName: "react-native",
                useSemverCoerce: true,
            },
        ];

        if (isRNWindows) {
            parsedPackages.push({
                packageName: "react-native-windows",
                useSemverCoerce: false,
            });
        }

        let versionPromises: Q.Promise<PackageVersion>[] = [];

        parsedPackages.forEach(parsedPackage => {
            versionPromises.push(
                ReactNativeProjectHelper.getProcessedVersionFromNodeModules(projectRoot, parsedPackage)
            );
        });

        return Q.all(versionPromises).then(packageVersionArray => {
            return packageVersionArray.reduce((allPackageVersions, packageVersion) => {
                return Object.assign(allPackageVersions, packageVersion);
            }, {});
        })
        .then(packageVersions => {
            if (packageVersions["react-native"].startsWith("error")) {
                throw ErrorHelper.getInternalError(InternalErrorCode.ReactNativePackageIsNotInstalled);
            }
            return {
                reactNativeVersion: packageVersions["react-native"],
                reactNativeWindowsVersion: packageVersions["react-native-windows"] || ReactNativeProjectHelper.RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES,
            };
        });
    }

    public static getReactNativeVersionsFromProjectPackage(cwd: string, isRNWindows: boolean = false): Q.Promise<RNPackageVersions> {
        let parsedPackages: ParsedPackage[] = [
            {
                packageName: "react-native",
                useSemverCoerce: true,
            },
        ];

        if (isRNWindows) {
            parsedPackages.push({
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

                        parsedPackages.forEach(parsedPackage => {
                            try {
                                if (dependencies[parsedPackage.packageName]) {
                                    parsedPackageVersions[parsedPackage.packageName] = ReactNativeProjectHelper.processVersion(dependencies[parsedPackage.packageName], parsedPackage.useSemverCoerce);
                                } else if (devDependencies[parsedPackage.packageName]) {
                                    parsedPackageVersions[parsedPackage.packageName] = ReactNativeProjectHelper.processVersion(devDependencies[parsedPackage.packageName], parsedPackage.useSemverCoerce);
                                } else {
                                    parsedPackageVersions[parsedPackage.packageName] = ReactNativeProjectHelper.RN_VERSION_ERRORS.MISSING_DEPENDENCY;
                                }
                            } catch (err) {
                                parsedPackageVersions[parsedPackage.packageName] = ReactNativeProjectHelper.RN_VERSION_ERRORS.MISSING_DEPENDENCIES_FIELDS;
                            }
                        });

                        return {
                            reactNativeVersion: parsedPackageVersions["react-native"],
                            reactNativeWindowsVersion: parsedPackageVersions["react-native-windows"] || ReactNativeProjectHelper.RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES,
                        };
                    });
            })
            .catch(err => ({
                reactNativeVersion: ReactNativeProjectHelper.RN_VERSION_ERRORS.UNKNOWN_ERROR,
                reactNativeWindowsVersion: ReactNativeProjectHelper.RN_VERSION_ERRORS.UNKNOWN_ERROR,
            }));
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
                return !versions.reactNativeVersion.startsWith("error");
            });
    }

    public static isHaulProject(projectRoot: string): boolean {
        if (!projectRoot || !fs.existsSync(path.join(projectRoot, "package.json"))) {
            return false;
        }

        const packageJson = require(path.join(projectRoot, "package.json"));
        const haulVersion = packageJson.devDependencies && (packageJson.devDependencies.haul || packageJson.devDependencies["@haul-bundler/cli"]);
        return !!haulVersion;
    }

    private static getProcessedVersionFromNodeModules(projectRoot: string, parsedPackage: ParsedPackage): Q.Promise<PackageVersion> {
        return new Package(projectRoot).getPackageVersionFromNodeModules(parsedPackage.packageName)
            .then(version => ({[parsedPackage.packageName]: ReactNativeProjectHelper.processVersion(version, parsedPackage.useSemverCoerce)}))
            .catch(err => ({[parsedPackage.packageName]: ReactNativeProjectHelper.RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES}));
    }
}
