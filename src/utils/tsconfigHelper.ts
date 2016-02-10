// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as vscode from "vscode";
import fs = require("fs");
import path = require("path");
import {FileSystem} from "./node/fileSystem";

export class TsConfigHelper {

    public static get tsConfigPath(): string {
        return path.join(vscode.workspace.rootPath, "tsconfig.json");
    }

    /**
     * Constructs a JSON object from tsconfig.json. Will create the file if needed.
     */
    public static readConfigJson(): Q.Promise<any> {
        let tsConfigPath: string = TsConfigHelper.tsConfigPath;
        let fileSystem = new FileSystem();

        return fileSystem.exists(tsConfigPath)
        .then(function(exists: boolean): Q.Promise<void> {
            if (!exists) {
                return fileSystem.writeFile(tsConfigPath, "{}");
            }
        })
        .then(function(): Q.Promise<string> {
            return fileSystem.readFile(tsConfigPath, "utf-8");
        })
        .then(function(jsonContents: string): Q.Promise<any> {
            return JSON.parse(jsonContents);
        });
    }

    /**
     * Writes out a JSON configuration object to the tsconfig.json file.
     */
    public static writeConfigJson(configJson: any): Q.Promise<void> {
        let tsConfigPath: string = TsConfigHelper.tsConfigPath;

        return Q.nfcall<void>(fs.writeFile, tsConfigPath, JSON.stringify(configJson, null, 4));
    }

    /**
     * Enable javascript intellisense via typescript.
     */
    public static allowJs(enabled: boolean): Q.Promise<void> {
        return TsConfigHelper.readConfigJson()
        .then(function(tsConfigJson: any): Q.Promise<void> {
            tsConfigJson.compilerOptions = tsConfigJson.compilerOptions || {};

            // Return if the setting is already correctly set.
            if (tsConfigJson.compilerOptions.allowJs === enabled) {
                return Q.resolve<void>(void 0);
            }

            tsConfigJson.compilerOptions.allowJs = enabled;

            return TsConfigHelper.writeConfigJson(tsConfigJson);
        });
    }

    /**
     * Add directories to be excluded by the Typescript compiler.
     */
    public static addExcludePaths(excludePaths: string[]): Q.Promise<void> {
        return TsConfigHelper.readConfigJson()
        .then(function(tsConfigJson: any) {
            let currentExcludes: string[] = tsConfigJson.exclude || [];
            let isDirty: boolean = false;

            excludePaths.forEach(function(exclude: string){
                if (currentExcludes.indexOf(exclude) < 0) {
                    currentExcludes.push(exclude);
                    isDirty = true;
                }
            });

            if (isDirty) {
                tsConfigJson.exclude = currentExcludes;

                return TsConfigHelper.writeConfigJson(tsConfigJson);
            }
        });
    }
}
