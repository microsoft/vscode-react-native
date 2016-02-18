// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {Node} from "./node";
import * as pathModule from "path";
import * as Q from "q";

interface IPackageDependencyDict {
    [packageName: string]: string;
}

export interface IPackageInformation {
    name: string;
    version: string;
    dependencies?: IPackageDependencyDict;
    main?: string;
    [key: string]: any;
}

export class Package {
    private _path: string;
    private INFORMATION_PACKAGE_FILENAME = "package.json";
    private DEPENDENCIES_SUBFOLDER = "node_modules";

    constructor(path: string) {
        this._path = path;
    }

    public parsePackageInformation(): Q.Promise<IPackageInformation> {
        return new Node.FileSystem().readFile(this.informationJsonFilePath(), "utf8")
            .then(data =>
                <IPackageInformation>JSON.parse(data));
    }

    public name(): Q.Promise<string> {
        return this.parseProperty("name");
    }

    public dependencies(): Q.Promise<IPackageDependencyDict> {
        return this.parseProperty("dependencies");
    }

    public version(): Q.Promise<string> {
        return this.parseProperty("version").then(version =>
            typeof version === "string"
                ? version
                : Q.reject<string>(`Couldn't parse the version component of the package at ${this.informationJsonFilePath()}: version = ${version}`));
    }

    public setMainFile(value: string): Q.Promise<void> {
        return this.parsePackageInformation()
            .then(packageInformation => {
                packageInformation.main = value;
                return new Node.FileSystem().writeFile(this.informationJsonFilePath(), JSON.stringify(<Object>packageInformation));
            });
    }

    public dependencyPath(dependencyName: string) {
        return pathModule.resolve(this._path, this.DEPENDENCIES_SUBFOLDER, dependencyName);
    }

    public dependencyPackage(dependencyName: string): Package {
        return new Package(this.dependencyPath(dependencyName));
    }

    private informationJsonFilePath(): string {
        return pathModule.resolve(this._path, this.INFORMATION_PACKAGE_FILENAME);
    }

    private parseProperty(name: string): Q.Promise<any> {
        return this.parsePackageInformation()
            .then(packageInformation => packageInformation[name]);
    }
}
