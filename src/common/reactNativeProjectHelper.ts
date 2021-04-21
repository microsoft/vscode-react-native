// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import { ProjectVersionHelper } from "./projectVersionHelper";

export interface ParsedPackage {
    packageName: string;
    useSemverCoerce: boolean;
}

export class ReactNativeProjectHelper {
    /**
     * Ensures that we are in a React Native project
     * Otherwise, displays an error message banner
     */
    public static isReactNativeProject(projectRoot: string): Promise<boolean> {
        if (!projectRoot || !fs.existsSync(path.join(projectRoot, "package.json"))) {
            return Promise.resolve(false);
        }
        return ProjectVersionHelper.getReactNativeVersionsFromProjectPackage(projectRoot).then(
            versions => {
                return !ProjectVersionHelper.isVersionError(versions.reactNativeVersion);
            },
        );
    }

    public static isHaulProject(projectRoot: string): boolean {
        const packageJsonPath = path.join(projectRoot, "package.json");
        if (!projectRoot || !fs.existsSync(packageJsonPath)) {
            return false;
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        const haulVersion =
            packageJson.devDependencies &&
            (packageJson.devDependencies.haul || packageJson.devDependencies["@haul-bundler/cli"]);
        return !!haulVersion;
    }
}
