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
    public static readConfigJson(): any {
        var tsConfigPath:string = TsConfigHelper.tsConfigPath;
        var fileSystem = new FileSystem();
        if (!fileSystem.existsSync(tsConfigPath)) {
            fs.writeFileSync(tsConfigPath, "{}");
        }

        try {
            return JSON.parse(fs.readFileSync(tsConfigPath, "utf-8"));
        } catch(err) {
            throw new Error("Failed to parse tsconfig.json");
        }

    }

    /**
     * Writes out a JSON configuration object to the tsconfig.json file.
     */
    public static writeConfigJson(json:any): void {
        var tsConfigPath:string = TsConfigHelper.tsConfigPath;
        fs.writeFileSync(tsConfigPath, JSON.stringify(json, null, 4));
    }

    /**
     * Enable javascript intellisense via typescript.
     */
    public static compileJavaScript(enabled:boolean): void {
        var tsConfigJson:any = TsConfigHelper.readConfigJson();

        tsConfigJson.compilerOptions = tsConfigJson.compilerOptions || {};
        tsConfigJson.compilerOptions.allowJs = enabled;

        TsConfigHelper.writeConfigJson(tsConfigJson);
    }
}
