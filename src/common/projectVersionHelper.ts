// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as semver from "semver";
import {URL} from "url";
import {Package} from "./node/package";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {ParsedPackage} from "./reactNativeProjectHelper";
import {RN_VERSION_ERRORS} from "./error/versionError";

export interface PackageVersion {
    [packageName: string]: string;
}

export interface RNPackageVersions {
    reactNativeVersion: string;
    reactNativeWindowsVersion: string;
    reactNativemacOSVersion: string;
}

export class ProjectVersionHelper {

    public static getRNVersionsWithBrokenMetroBundler(): string[] {
        // https://github.com/microsoft/vscode-react-native/issues/660 for details
        return ["0.54.0", "0.54.1", "0.54.2", "0.54.3", "0.54.4"];
    }

    public static getReactNativeVersions(projectRoot: string, isRNWindows: boolean = false): Promise<RNPackageVersions> {
        return ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(projectRoot, isRNWindows)
            .catch(() => {
                return ProjectVersionHelper.getReactNativeVersionsFromProjectPackage(projectRoot, isRNWindows);
            });
    }

    public static getReactNativePackageVersionsFromNodeModules(projectRoot: string, isRNWindows: boolean = false, isRNmacOS: boolean): Promise<RNPackageVersions> {
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

        if (isRNmacOS) {
            parsedPackages.push({
                packageName: "react-native-macos",
                useSemverCoerce: false,
            });
        }

        let versionPromises: Promise<PackageVersion>[] = [];

        parsedPackages.forEach(parsedPackage => {
            versionPromises.push(
                ProjectVersionHelper.getProcessedVersionFromNodeModules(projectRoot, parsedPackage)
            );
        });

        return Promise.all(versionPromises).then(packageVersionArray => {
            return packageVersionArray.reduce((allPackageVersions, packageVersion) => {
                return Object.assign(allPackageVersions, packageVersion);
            }, {});
        })
        .then(packageVersions => {
            if (ProjectVersionHelper.isVersionError(packageVersions["react-native"])) {
                throw ErrorHelper.getInternalError(InternalErrorCode.ReactNativePackageIsNotInstalled);
            }
            return {
                reactNativeVersion: packageVersions["react-native"],
                reactNativeWindowsVersion: packageVersions["react-native-windows"] || RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES,
                reactNativemacOSVersion: packageVersions["react-native-macos"] || RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES,
            };
        });
    }

    public static getReactNativeVersionsFromProjectPackage(cwd: string, isRNWindows: boolean = false, isRNmacOS: boolean = false): Promise<RNPackageVersions> {
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

        if (isRNmacOS) {
            parsedPackages.push({
                packageName: "react-native-macos",
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
                                    parsedPackageVersions[parsedPackage.packageName] = ProjectVersionHelper.processVersion(dependencies[parsedPackage.packageName], parsedPackage.useSemverCoerce);
                                } else if (devDependencies[parsedPackage.packageName]) {
                                    parsedPackageVersions[parsedPackage.packageName] = ProjectVersionHelper.processVersion(devDependencies[parsedPackage.packageName], parsedPackage.useSemverCoerce);
                                } else {
                                    parsedPackageVersions[parsedPackage.packageName] = RN_VERSION_ERRORS.MISSING_DEPENDENCY_IN_PROJECT_PACKAGE_FILE;
                                }
                            } catch (err) {
                                parsedPackageVersions[parsedPackage.packageName] = RN_VERSION_ERRORS.MISSING_DEPENDENCIES_FIELDS_IN_PROJECT_PACKAGE_FILE;
                            }
                        });

                        return {
                            reactNativeVersion: parsedPackageVersions["react-native"],
                            reactNativeWindowsVersion: parsedPackageVersions["react-native-windows"] || RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES,
                            reactNativemacOSVersion: parsedPackageVersions["react-native-macos"] || RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES,
                        };
                    });
            })
            .catch(() => ({
                reactNativeVersion: RN_VERSION_ERRORS.UNKNOWN_ERROR,
                reactNativeWindowsVersion: RN_VERSION_ERRORS.UNKNOWN_ERROR,
                reactNativemacOSVersion: RN_VERSION_ERRORS.UNKNOWN_ERROR,
            }));
    }

    public static isVersionError(version: string): boolean {
        return version.toLowerCase().includes("error");
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

    private static getProcessedVersionFromNodeModules(projectRoot: string, parsedPackage: ParsedPackage): Promise<PackageVersion> {
        return new Package(projectRoot).getPackageVersionFromNodeModules(parsedPackage.packageName)
            .then(version => ({[parsedPackage.packageName]: ProjectVersionHelper.processVersion(version, parsedPackage.useSemverCoerce)}))
            .catch(err => ({[parsedPackage.packageName]: RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES}));
    }

}
