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
    public static async isReactNativeProject(projectRoot: string): Promise<boolean> {
        if (!projectRoot || !fs.existsSync(path.join(projectRoot, "package.json"))) {
            return false;
        }

        const versions = await ProjectVersionHelper.getReactNativeVersions(
            projectRoot,
            undefined,
            projectRoot,
        );
        return !ProjectVersionHelper.isVersionError(versions.reactNativeVersion);
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

    public static isAndroidHermesEnabled(projectRoot: string): boolean {
        const buildGradlePath = path.join(projectRoot, "android", "app", "build.gradle");
        if (!projectRoot || !fs.existsSync(buildGradlePath)) {
            return false;
        }

        const buildGradleContent = fs.readFileSync(buildGradlePath, "utf-8");
        const hermesEnabled = /enableHermes\s*:\s*true/.test(buildGradleContent);
        return hermesEnabled;
    }

    public static isIOSHermesEnabled(projectRoot: string): boolean {
        const podfilePath = path.join(projectRoot, "ios", "Podfile");
        if (!projectRoot || !fs.existsSync(podfilePath)) {
            return false;
        }

        const podfileContent = fs.readFileSync(podfilePath, "utf-8");
        const matches = podfileContent.match(/#?\s*:hermes_enabled\s*=>\s*true/);
        return !!(matches && !matches[0].startsWith("#"));
    }

    public static isMacOSHermesEnabled(projectRoot: string): boolean {
        const podfilePath = path.join(projectRoot, "macos", "Podfile");
        if (!projectRoot || !fs.existsSync(podfilePath)) {
            return false;
        }

        const podfileContent = fs.readFileSync(podfilePath, "utf-8");
        let matches = podfileContent.match(/#?\s*:hermes_enabled\s*=>\s*(true|false)/);

        if (matches && matches.length > 1) {
            return !matches[0].startsWith("#") && matches[1] === "true";
        }

        matches = podfileContent.match(/#?\s*pod\s*'hermes'/);
        return !!(matches && !matches[0].startsWith("#"));
    }

    public static isWindowsHermesEnabled(projectRoot: string): boolean {
        const experimentalFeaturesPath = path.join(
            projectRoot,
            "windows",
            "ExperimentalFeatures.props",
        );
        if (!projectRoot || !fs.existsSync(experimentalFeaturesPath)) {
            return false;
        }

        const experimentalFeaturesContent = fs.readFileSync(experimentalFeaturesPath, "utf-8");
        const hermesEnabled = /<UseHermes>true<\/UseHermes>/.test(experimentalFeaturesContent);
        return hermesEnabled;
    }
}
