// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {FileSystem} from "../../common/node/fileSystem";
import Q = require("q");
import * as path from "path";

export class PackageNameResolver {

    private static PackageNameRegexp: RegExp = /package="(.+?)"/;
    private static ManifestName = "AndroidManifest.xml";
    private static DefaultPackagePrefix = "com.";
    private static SourceRootRelPath: string[] = ["android", "app", "src", "main"];
    private static DefaultManifestLocation: string[] = PackageNameResolver.SourceRootRelPath.concat(PackageNameResolver.ManifestName);
    private applicationName: string;

    constructor(applicationName: string) {
        this.applicationName = applicationName;
    }

    /**
     * Tries to find the package name in AndroidManifest.xml. If not found, it returns the default package name,
     * which is the application name prefixed with the default prefix.
     */
    public resolvePackageName(projectRoot: string): Q.Promise<string> {
        let expectedAndroidManifestPath = path.join.apply(this, [projectRoot].concat(PackageNameResolver.DefaultManifestLocation));
        return this.readPackageName(expectedAndroidManifestPath);
    }

    /**
     * Given a manifest file path, it parses the file and returns the package name.
     * If the package name cannot be parsed, the default packge name is returned.
     */
    private readPackageName(manifestPath: string): Q.Promise<string> {
        if (manifestPath) {
            let fs = new FileSystem();
            return fs.exists(manifestPath).then(exists => {
                if (exists) {
                    return fs.readFile(manifestPath)
                        .then(manifestContent => {
                            let packageName = this.parsePackageName(manifestContent);
                            if (!packageName) {
                                packageName = this.getDefaultPackageName(this.applicationName);
                            }
                            return packageName;
                        });
                } else {
                    return this.getDefaultPackageName(this.applicationName);
                }
            });
        } else {
            return Q.resolve(this.getDefaultPackageName(this.applicationName));
        }
    }

    /**
     * Gets the default package name, based on the application name.
     */
    private getDefaultPackageName(applicationName: string): string {
        return PackageNameResolver.DefaultPackagePrefix + applicationName.toLowerCase();
    }

    /**
     * Parses the application package name from the contents of an Android manifest file.
     * If a match was found, it is returned. Otherwise null is returned.
     */
    private parsePackageName(manifestContents: string) {
        // first we remove all the comments from the file
        let match = manifestContents.match(PackageNameResolver.PackageNameRegexp);
        return match ? match[1] : null;
    }
}