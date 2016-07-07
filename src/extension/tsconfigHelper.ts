// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as vscode from "vscode";
// import fs = require("fs");
import path = require("path");
import {FileSystem} from "../common/node/fileSystem";

export class TsConfigHelper {

    private static get tsConfigPath(): string {
        return path.join(vscode.workspace.rootPath, "tsconfig.json");
    }

    /**
     * Constructs a JSON object from tsconfig.json. Will create the file if needed.
     */
    public static createTsConfigIfNotPresent(): Q.Promise<any> {
        let tsConfigPath: string = TsConfigHelper.tsConfigPath;
        let fileSystem = new FileSystem();

        return fileSystem.exists(tsConfigPath)
            .then(function (exists: boolean): Q.Promise<void> {
                if (!exists) {
                    const defaultTsConfig = {
                        compilerOptions: {
                            allowJs: true,
                        },
                        exclude: ["node_modules"],
                    };
                    return fileSystem.writeFile(tsConfigPath, JSON.stringify(defaultTsConfig));
                }
            });
    }
}
