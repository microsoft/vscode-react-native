// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as semver from "semver";
import { URL } from "url";
import { Package } from "./node/package";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { ParsedPackage } from "./reactNativeProjectHelper";
import { RN_VERSION_ERRORS } from "./error/versionError";
import { ILaunchArgs, PlatformType } from "../extension/launchArgs";
import { AppLauncher } from "../extension/appLauncher";

export interface PackageVersion {
    [packageName: string]: string;
}

export interface RNPackageVersions {
    reactNativeVersion: string;
    reactNativeWindowsVersion: string;
    reactNativeMacOSVersion: string;
}

export const REACT_NATIVE_PACKAGES: Record<string, ParsedPackage> = {
    REACT_NATIVE: {
        packageName: "react-native",
        useSemverCoerce: true,
    },
    REACT_NATIVE_WINDOWS: {
        packageName: "react-native-windows",
        useSemverCoerce: false,
    },
    REACT_NATIVE_MACOS: {
        packageName: "react-native-macos",
        useSemverCoerce: false,
    },
};

export class ProjectVersionHelper {
    private static SEMVER_INVALID = "SemverInvalid";

    public static getRNVersionsWithBrokenMetroBundler(): string[] {
        // https://github.com/microsoft/vscode-react-native/issues/660 for details
        return ["0.54.0", "0.54.1", "0.54.2", "0.54.3", "0.54.4"];
    }

    public static async getReactNativeVersions(
        projectRoot: string,
        additionalPackagesToCheck?: ParsedPackage[],
        nodeModulesRoot?: string,
    ): Promise<RNPackageVersions> {
        if (!nodeModulesRoot) {
            nodeModulesRoot = AppLauncher.getNodeModulesRootByProjectPath(projectRoot);
        }

        try {
            return await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
                nodeModulesRoot,
                additionalPackagesToCheck,
            );
        } catch (error) {
            return ProjectVersionHelper.getReactNativeVersionsFromProjectPackage(
                projectRoot,
                additionalPackagesToCheck,
            );
        }
    }

    public static async tryToGetRNSemverValidVersionsFromProjectPackage(
        projectRoot: string,
        additionalPackagesToCheck?: ParsedPackage[],
        nodeModulesRoot?: string,
    ): Promise<RNPackageVersions> {
        const versions = await ProjectVersionHelper.getReactNativeVersionsFromProjectPackage(
            projectRoot,
            additionalPackagesToCheck,
        );
        if (
            Object.values(versions).findIndex(packageVersion =>
                packageVersion.includes(this.SEMVER_INVALID),
            ) !== -1
        ) {
            if (!nodeModulesRoot) {
                nodeModulesRoot = AppLauncher.getNodeModulesRootByProjectPath(projectRoot);
            }

            try {
                return await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
                    nodeModulesRoot,
                    additionalPackagesToCheck,
                );
            } catch (error) {
                return versions;
            }
        } else {
            return versions;
        }
    }

    public static generateAdditionalPackagesToCheckByPlatform(args: ILaunchArgs): ParsedPackage[] {
        let additionalPackages: ParsedPackage[] = [];
        if (args.platform === PlatformType.Windows) {
            additionalPackages.push(REACT_NATIVE_PACKAGES.REACT_NATIVE_WINDOWS);
        }

        if (args.platform === PlatformType.macOS) {
            additionalPackages.push(REACT_NATIVE_PACKAGES.REACT_NATIVE_MACOS);
        }

        return additionalPackages;
    }

    public static generateAllAdditionalPackages(): ParsedPackage[] {
        return [
            REACT_NATIVE_PACKAGES.REACT_NATIVE_WINDOWS,
            REACT_NATIVE_PACKAGES.REACT_NATIVE_MACOS,
        ];
    }

    public static async getReactNativePackageVersionsFromNodeModules(
        nodeModulesRoot: string,
        additionalPackagesToCheck?: ParsedPackage[],
    ): Promise<RNPackageVersions> {
        let parsedPackages: ParsedPackage[] = [REACT_NATIVE_PACKAGES.REACT_NATIVE];

        if (additionalPackagesToCheck) {
            parsedPackages.push(...additionalPackagesToCheck);
        }

        let versionPromises: Promise<PackageVersion>[] = [];

        parsedPackages.forEach(parsedPackage => {
            versionPromises.push(
                ProjectVersionHelper.getProcessedVersionFromNodeModules(
                    nodeModulesRoot,
                    parsedPackage,
                ),
            );
        });

        const packageVersionArray = await Promise.all(versionPromises);
        const packageVersions = packageVersionArray.reduce((allPackageVersions, packageVersion) => {
            return Object.assign(allPackageVersions, packageVersion);
        }, {});
        if (ProjectVersionHelper.isVersionError(packageVersions["react-native"])) {
            throw ErrorHelper.getInternalError(InternalErrorCode.ReactNativePackageIsNotInstalled);
        }
        return {
            reactNativeVersion: packageVersions["react-native"],
            reactNativeWindowsVersion:
                packageVersions["react-native-windows"] ||
                RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES,
            reactNativeMacOSVersion:
                packageVersions["react-native-macos"] ||
                RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES,
        };
    }

    public static async getReactNativeVersionsFromProjectPackage(
        cwd: string,
        additionalPackagesToCheck?: ParsedPackage[],
    ): Promise<RNPackageVersions> {
        let parsedPackages: ParsedPackage[] = [REACT_NATIVE_PACKAGES.REACT_NATIVE];

        if (additionalPackagesToCheck) {
            parsedPackages.push(...additionalPackagesToCheck);
        }

        const rootProjectPackageJson = new Package(cwd);

        try {
            const dependencies = rootProjectPackageJson.dependencies();
            const devDependencies = rootProjectPackageJson.devDependencies();

            let parsedPackageVersions: PackageVersion = {};

            parsedPackages.forEach(parsedPackage => {
                try {
                    if (dependencies[parsedPackage.packageName]) {
                        parsedPackageVersions[
                            parsedPackage.packageName
                        ] = ProjectVersionHelper.processVersion(
                            dependencies[parsedPackage.packageName],
                            parsedPackage.useSemverCoerce,
                        );
                    } else if (devDependencies[parsedPackage.packageName]) {
                        parsedPackageVersions[
                            parsedPackage.packageName
                        ] = ProjectVersionHelper.processVersion(
                            devDependencies[parsedPackage.packageName],
                            parsedPackage.useSemverCoerce,
                        );
                    } else {
                        parsedPackageVersions[parsedPackage.packageName] =
                            RN_VERSION_ERRORS.MISSING_DEPENDENCY_IN_PROJECT_PACKAGE_FILE;
                    }
                } catch (err) {
                    parsedPackageVersions[parsedPackage.packageName] =
                        RN_VERSION_ERRORS.MISSING_DEPENDENCIES_FIELDS_IN_PROJECT_PACKAGE_FILE;
                }
            });

            return {
                reactNativeVersion: parsedPackageVersions["react-native"],
                reactNativeWindowsVersion:
                    parsedPackageVersions["react-native-windows"] ||
                    RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES,
                reactNativeMacOSVersion:
                    parsedPackageVersions["react-native-macos"] ||
                    RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES,
            };
        } catch (error) {
            return {
                reactNativeVersion: RN_VERSION_ERRORS.UNKNOWN_ERROR,
                reactNativeWindowsVersion: RN_VERSION_ERRORS.UNKNOWN_ERROR,
                reactNativeMacOSVersion: RN_VERSION_ERRORS.UNKNOWN_ERROR,
            };
        }
    }

    public static isVersionError(version: string): boolean {
        return version.toLowerCase().includes("error");
    }

    public static processVersion(version: string, useSemverCoerce: boolean = true): string {
        try {
            return new URL(version) && `${this.SEMVER_INVALID}: URL`;
        } catch (err) {
            let versionObj;
            // As some of 'react-native-windows' versions contain postfixes we cannot use 'coerce' function to parse them
            // as some critical parts of the version string will be dropped. To save this information we use 'clean' function
            if (useSemverCoerce) {
                versionObj = semver.coerce(version);
            } else {
                versionObj = semver.clean(version.replace(/[\^~<>]/g, ""), { loose: true });
            }
            return (versionObj && versionObj.toString()) || this.SEMVER_INVALID;
        }
    }

    private static async getProcessedVersionFromNodeModules(
        projectRoot: string,
        parsedPackage: ParsedPackage,
    ): Promise<PackageVersion> {
        try {
            const version = await new Package(projectRoot).getPackageVersionFromNodeModules(
                parsedPackage.packageName,
            );
            return {
                [parsedPackage.packageName]: ProjectVersionHelper.processVersion(
                    version,
                    parsedPackage.useSemverCoerce,
                ),
            };
        } catch (error) {
            return {
                [parsedPackage.packageName]: RN_VERSION_ERRORS.MISSING_PACKAGE_IN_NODE_MODULES,
            };
        }
    }
}
