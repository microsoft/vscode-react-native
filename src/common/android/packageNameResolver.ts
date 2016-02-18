// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {FileSystem} from "../../common/node/fileSystem";
import Q = require("q");
import * as path from "path";

export class PackageNameResolver {

    private static PackageNameRegexp: RegExp = /<(?:.|\n)*?manifest(?:.|\n)+?package\s*=\s*"(.+?)"(?:.|\n)*?>/m;
    private static CommentsRegexp: RegExp = /(<!--.*?-->)/g;
    private static ManifestName = "AndroidManifest.xml";
    private static DefaultPackagePrefix = "com.";
    private static SourceRootRelPath: string[] = ["android", "app", "src"];
    private static DefaultManifestLocation: string[] = PackageNameResolver.SourceRootRelPath.concat("main", PackageNameResolver.ManifestName);

    public resolvePackageName(projectRoot: string, appName: string): Q.Promise<string> {
        let fs = new FileSystem();
        let expectedAndroidManifestPath = path.join.apply(this, [projectRoot].concat(PackageNameResolver.DefaultManifestLocation));

        return fs.exists(expectedAndroidManifestPath).then(exists => {
            if (exists) {
                return this.readPackageName(expectedAndroidManifestPath, appName);
            } else {
                /* search for the manifest in the source folder */
                let androidSrcPath = path.join.apply(this, [projectRoot].concat(PackageNameResolver.SourceRootRelPath));
                return fs.findFile(androidSrcPath, PackageNameResolver.ManifestName)
                    .then(actualManifestPath => {
                        return this.readPackageName(actualManifestPath, appName);
                    });
            }
        });
    }

    /**
     * Given a manifest file path, it parses the file and returns the package name.
     * If the package name cannot be parsed, the default packge name is returned.
     */
    private readPackageName(manifestPath: string, applicationName: string): Q.Promise<string> {
        if (manifestPath) {
            let fs = new FileSystem();
            return fs.exists(manifestPath).then(exists => {
                if (exists) {
                    return fs.readFile(manifestPath)
                        .then(manifestContent => this.parsePackageName(manifestContent))
                        .then(packageName => {
                            if (!packageName) {
                                packageName = this.getDefaultPackageName(applicationName);
                            }
                            return packageName;
                        });
                } else {
                    return this.getDefaultPackageName(applicationName);
                }
            });
        } else {
            return Q.resolve(this.getDefaultPackageName(applicationName));
        }
    }

    private getDefaultPackageName(applicationName: string): string {
        return PackageNameResolver.DefaultPackagePrefix + applicationName;
    }

    /**
     * Parses the application package name from the contents of an Android manifest file.
     * If a match was found, it is returned. Otherwise null is returned.
     */
    private parsePackageName(manifestContents: string) {
        // first we remove all the comments from the file
        let noCommentsManifest = manifestContents.replace(PackageNameResolver.CommentsRegexp, "");
        let match = noCommentsManifest.match(PackageNameResolver.PackageNameRegexp);
        return match ? match[1] : null;
    }
}