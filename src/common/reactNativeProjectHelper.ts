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

export interface RNPackageVersions {
    reactNativeVersion: string;
    reactNativeWindowsVersion: string;
}

export class ReactNativeProjectHelper {

    public static getRNVersionsWithBrokenMetroBundler() {
        // https://github.com/Microsoft/vscode-react-native/issues/660 for details
        return ["0.54.0", "0.54.1", "0.54.2", "0.54.3", "0.54.4"];
    }

    public static getReactNativeVersions(projectRoot: string, isRNWVersion: boolean = false): Q.Promise<RNPackageVersions> {
        return ReactNativeProjectHelper.getReactNativePackageVersionsFromNodeModules(projectRoot, isRNWVersion)
            .catch(err => {
                return ReactNativeProjectHelper.getReactNativeVersionsFromProjectPackage(projectRoot, isRNWVersion);
            });
    }

    public static getReactNativePackageVersionsFromNodeModules(projectRoot: string, isRNWVersion: boolean = false): Q.Promise<RNPackageVersions> {
        let versionPromises: Q.Promise<string>[] = [];

        versionPromises.push(
            new Package(projectRoot).getPackageVersionFromNodeModules("react-native")
                .then(version => ReactNativeProjectHelper.processVersion(version, true))
                .catch(err => {
                    throw ErrorHelper.getInternalError(InternalErrorCode.ReactNativePackageIsNotInstalled);
                })
            );

        if (isRNWVersion) {
            versionPromises.push(
                new Package(projectRoot).getPackageVersionFromNodeModules("react-native-windows")
                    .then(version => ReactNativeProjectHelper.processVersion(version, false))
                    .catch(err => "")
            );
        }

        return Q.all(versionPromises).then(packageVersions => ({
            reactNativeVersion: packageVersions[0],
            reactNativeWindowsVersion: packageVersions[1] || "",
        }));
    }

    public static getReactNativeVersionsFromProjectPackage(cwd: string, isRNWVersion: boolean = false): Q.Promise<RNPackageVersions> {
        let parsedPackageNames: ParsedPackageName[] = [
            {
                packageName: "react-native",
                useSemverCoerce: true,
            },
        ];

        if (isRNWVersion) {
            parsedPackageNames.push({
                packageName: "react-native-windows",
                useSemverCoerce: false,
            });
        }

        let versionPromises: Q.Promise<string>[] = [];

        parsedPackageNames.forEach(parsedPackageName => {
            versionPromises.push((() => {
                const rootProjectPackageJson = new Package(cwd);
                return rootProjectPackageJson.dependencies()
                    .then(dependencies => {
                        if (dependencies[parsedPackageName.packageName]) {
                            return ReactNativeProjectHelper.processVersion(dependencies[parsedPackageName.packageName], parsedPackageName.useSemverCoerce);
                        }
                        return rootProjectPackageJson.devDependencies()
                            .then(devDependencies => {
                                if (devDependencies[parsedPackageName.packageName]) {
                                    return ReactNativeProjectHelper.processVersion(devDependencies[parsedPackageName.packageName], parsedPackageName.useSemverCoerce);
                                }
                                return "";
                            });
                    })
                    .catch(err => {
                        return "";
                    });
                })()
            );
        });

        return Q.all(versionPromises).then(packageVersions => ({
            reactNativeVersion: packageVersions[0],
            reactNativeWindowsVersion: packageVersions[1] || "",
        }));
    }

    public static processVersion(version: string, useSemverCoerce: boolean = true): string {
        try {
            return new URL(version) && "SemverInvalid: URL";
        } catch (err) {
            let versionObj;
            if (useSemverCoerce) {
                versionObj = semver.coerce(version);
            } else {
                versionObj = semver.clean(version.replace(/[\^~]/g, ""), { loose: true });
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
}
