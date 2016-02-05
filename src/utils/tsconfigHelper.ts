// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as vscode from 'vscode';
import fs = require("fs");
import path = require("path");
import {FileSystem} from './node/fileSystem';

export class TsConfigHelper {

    public static get tsConfigPath(): string {
        return path.join(vscode.workspace.rootPath, "tsconfig.json");
    }

    /**
     * Constructs a JSON object from tsconfig.json. Will create the file if needed.
     */
    public static readConfigJson(): Q.Promise<any> {
        var tsConfigPath:string = TsConfigHelper.tsConfigPath;
        var fileSystem = new FileSystem();

        return fileSystem.exists(tsConfigPath)
        .then(function(exists:boolean): Q.Promise<void> {
            if (!exists) {
                return Q.nfcall<void>(fs.writeFile, tsConfigPath, "{}");
            }
        })
        .then(function(): Q.Promise<string> {
            return Q.nfcall<string>(fs.readFile, tsConfigPath, "utf-8");
        })
        .then(function(jsonContents: string): Q.Promise<any> {
            return JSON.parse(jsonContents);
        });
    }

    /**
     * Writes out a JSON configuration object to the tsconfig.json file.
     */
    public static writeConfigJson(configJson:any): Q.Promise<void> {
        var tsConfigPath:string = TsConfigHelper.tsConfigPath;

        return Q.nfcall<void>(fs.writeFile, tsConfigPath, JSON.stringify(configJson, null, 4));
    }

    /**
     * Enable javascript intellisense via typescript.
     */
    public static compileJavaScript(enabled:boolean): Q.Promise<void> {
        return TsConfigHelper.readConfigJson()
        .then(function(tsConfigJson:any): Q.Promise<any> {
            tsConfigJson.compilerOptions = tsConfigJson.compilerOptions || {};
            tsConfigJson.compilerOptions.allowJs = enabled;

            return tsConfigJson;
        })
        .then(TsConfigHelper.writeConfigJson);
    }
}
