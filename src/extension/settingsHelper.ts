// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as vscode from "vscode";
import fs = require("fs");
import path = require("path");
import {FileSystem} from "../common/node/fileSystem";

export class SettingsHelper {

    public static get settingsJsonPath(): string {
        return path.join(vscode.workspace.rootPath, ".vscode", "settings.json");
    }

    public static get launchJsonPath(): string {
        return path.join(vscode.workspace.rootPath, ".vscode", "launch.json");
    }

    /**
     * Constructs a JSON object from tsconfig.json. Will create the file if needed.
     */
    public static readSettingsJson(): Q.Promise<any> {
        let settingsJsonPath: string = SettingsHelper.settingsJsonPath;
        let fileSystem = new FileSystem();

        return fileSystem.exists(settingsJsonPath)
            .then(function(exists: boolean): Q.Promise<string> {
                if (!exists) {
                    return fileSystem.writeFile(settingsJsonPath, "{}")
                        .then(() => { return "{}"; });
                }

                return fileSystem.readFile(settingsJsonPath, "utf-8");
            })
            .then(function(jsonContents: string): Q.Promise<any> {
                return JSON.parse(jsonContents);
            });
    }

    /**
     * Writes out a JSON configuration object to the tsconfig.json file.
     */
    public static writeSettingsJson(settingsJson: any): Q.Promise<void> {
        let settingsJsonPath: string = SettingsHelper.settingsJsonPath;

        return Q.nfcall<void>(fs.writeFile, settingsJsonPath, JSON.stringify(settingsJson, null, 4));
    }

    /**
     * Enable javascript intellisense via typescript.
     */
    public static typescriptTsdk(path: string): Q.Promise<void> {
        return SettingsHelper.readSettingsJson()
            .then(function(settingsJson: any): Q.Promise<void> {
                if (settingsJson["typescript.tsdk"] !== path) {
                    settingsJson["typescript.tsdk"] = path;

                    return SettingsHelper.writeSettingsJson(settingsJson);
                }
            });
    }

    public static getTypescriptTsdk(): Q.Promise<string> {
        return SettingsHelper.readSettingsJson()
            .then(function(settingsJson: any): Q.Promise<string> {
                return settingsJson["typescript.tsdk"] || "";
            });
    }
}
