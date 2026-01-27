// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import { FileSystem } from "../../common/node/fileSystem";

export class PackageNameResolver {
    private static PackageNameRegexp: RegExp = /package="(.+?)"/;
    private static ApplicationIdRegexp: RegExp = /applicationId\s+(=)?\s*["'](.+?)["']/;
    private static ManifestName = "AndroidManifest.xml";
    private static GradleBuildName = "build.gradle";
    private static DefaultPackagePrefix = "com.";
    private static SourceRootRelPath: string[] = ["android", "app", "src", "main"];
    private static DefaultManifestLocation: string[] = PackageNameResolver.SourceRootRelPath.concat(
        PackageNameResolver.ManifestName,
    );
    private static DefaultGradleBuildLocation: string[] = [
        "android",
        "app",
        PackageNameResolver.GradleBuildName,
    ];
    private applicationName: string;
    private fileSystem: FileSystem;

    constructor(applicationName: string, fileSystem?: FileSystem) {
        this.applicationName = applicationName;
        this.fileSystem = fileSystem || new FileSystem();
    }

    /**
     * Tries to find the package name in AndroidManifest.xml. If not found, it returns the default package name,
     * which is the application name prefixed with the default prefix.
     */
    public async resolvePackageName(projectRoot: string): Promise<string> {
        const expectedGradleBuildPath = path.join.apply(
            this,
            [projectRoot].concat(PackageNameResolver.DefaultGradleBuildLocation),
        );
        const gradlePackageName = await this.readApplicationId(expectedGradleBuildPath);
        if (gradlePackageName) {
            return gradlePackageName;
        }

        const expectedAndroidManifestPath = path.join.apply(
            this,
            [projectRoot].concat(PackageNameResolver.DefaultManifestLocation),
        );
        return this.readPackageName(expectedAndroidManifestPath);
    }

    private async readApplicationId(gradlePath: string): Promise<string | null> {
        if (!(await this.fileSystem.exists(gradlePath))) {
            return null;
        }

        const content = await this.fileSystem.readFile(gradlePath);
        const match = content.toString().match(PackageNameResolver.ApplicationIdRegexp);
        return match ? match[2] : null;
    }

    /**
     * Given a manifest file path, it parses the file and returns the package name.
     * If the package name cannot be parsed, the default packge name is returned.
     */
    private async readPackageName(manifestPath: string): Promise<string> {
        if (!(await this.fileSystem.exists(manifestPath))) {
            return this.getDefaultPackageName(this.applicationName);
        }

        const manifestContent = await this.fileSystem.readFile(manifestPath);
        const packageName = this.parsePackageName(manifestContent.toString());
        return packageName || this.getDefaultPackageName(this.applicationName);
    }

    /**
     * Gets the default package name, based on the application name.
     */
    private getDefaultPackageName(applicationName: string): string {
        return (PackageNameResolver.DefaultPackagePrefix + applicationName).toLowerCase();
    }

    /**
     * Parses the application package name from the contents of an Android manifest file.
     * If a match was found, it is returned. Otherwise null is returned.
     */
    private parsePackageName(manifestContents: string) {
        // first we remove all the comments from the file
        const match = manifestContents.match(PackageNameResolver.PackageNameRegexp);
        return match ? match[1] : null;
    }
}
