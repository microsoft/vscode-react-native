// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as pathModule from "path";

import { FileSystem } from "./fileSystem";
import { ErrorHelper } from "../error/errorHelper";
import { InternalErrorCode } from "../error/internalErrorCode";

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

    public getPackageVersionFromNodeModules(packageName: string): Promise<string> {
        return this.dependencyPackage(packageName).version();
    }

    public parsePackageInformation(): Promise<IPackageInformation> {
        return this.fileSystem
            .readFile(this.informationJsonFilePath(), "utf8")
            .then(data => <IPackageInformation>JSON.parse(data.toString()));
    }

    public name(): Promise<string> {
        return this.parseProperty("name");
    }

    public dependencies(): Promise<IPackageDependencyDict> {
        return this.parseProperty("dependencies");
    }

    public devDependencies(): Promise<IPackageDependencyDict> {
        return this.parseProperty("devDependencies");
    }

    public version(): Promise<string> {
        return this.parseProperty("version").then(version =>
            typeof version === "string"
                ? version
                : Promise.reject<string>(
                      ErrorHelper.getInternalError(
                          InternalErrorCode.CouldNotParsePackageVersion,
                          this.informationJsonFilePath(),
                          version,
                      ),
                  ),
        );
    }

    public setMainFile(value: string): Promise<void> {
        return this.parsePackageInformation().then(packageInformation => {
            packageInformation.main = value;
            return this.fileSystem.writeFile(
                this.informationJsonFilePath(),
                JSON.stringify(<Record<string, any>>packageInformation),
            );
        });
    }

    public dependencyPath(dependencyName: string): string {
        return pathModule.resolve(this._path, this.DEPENDENCIES_SUBFOLDER, dependencyName);
    }

    public dependencyPackage(dependencyName: string): Package {
        return new Package(this.dependencyPath(dependencyName), { fileSystem: this.fileSystem });
    }

    public informationJsonFilePath(): string {
        return pathModule.resolve(this._path, this.INFORMATION_PACKAGE_FILENAME);
    }

    private parseProperty(name: string): Promise<any> {
        return this.parsePackageInformation().then(packageInformation => packageInformation[name]);
    }
}
