// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as pathModule from "path";
import * as Q from "q";

import {FileSystem} from "./fileSystem";

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
    private INFORMATION_PACKAGE_FILENAME = "package.json";
    private DEPENDENCIES_SUBFOLDER = "node_modules";

    private fileSystem: FileSystem;

    private _path: string;

    constructor(path: string, { fileSystem = new FileSystem() } = {}) {
        this._path = path;
        this.fileSystem = fileSystem;
    }

    public parsePackageInformation(): Q.Promise<IPackageInformation> {
        return this.fileSystem.readFile(this.informationJsonFilePath(), "utf8")
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
                return this.fileSystem.writeFile(this.informationJsonFilePath(), JSON.stringify(<Object>packageInformation));
            });
    }

    public dependencyPath(dependencyName: string) {
        return pathModule.resolve(this._path, this.DEPENDENCIES_SUBFOLDER, dependencyName);
    }

    public dependencyPackage(dependencyName: string): Package {
        return new Package(this.dependencyPath(dependencyName), { fileSystem: this.fileSystem});
    }

    public informationJsonFilePath(): string {
        return pathModule.resolve(this._path, this.INFORMATION_PACKAGE_FILENAME);
    }

    private parseProperty(name: string): Q.Promise<any> {
        return this.parsePackageInformation()
            .then(packageInformation =>
                packageInformation[name]);
    }
}
