// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as vscode from "vscode";
import path = require("path");
import {FileSystem} from "../common/node/fileSystem";

export class JsConfigHelper {

    // We're not going to create tsconfig.json - we just need this property to
    // check for existense of tsconfig.json and cancel setup if it's present
    private static get tsConfigPath(): string {
        return path.join(vscode.workspace.rootPath, "tsconfig.json");
    }

    private static get jsConfigPath(): string {
        return path.join(vscode.workspace.rootPath, "jsconfig.json");
    }

    private static defaultJsConfig = {
        compilerOptions: {
            allowJs: true,
            allowSyntheticDefaultImports: true,
        },
        exclude: ["node_modules"],
    };

    /**
     * Constructs a JSON object from jsconfig.json. Will create the file if needed.
     */
    public static createJsConfigIfNotPresent(): Q.Promise<void> {
        let fileSystem = new FileSystem();

        return Q.all([fileSystem.exists(JsConfigHelper.jsConfigPath), fileSystem.exists(JsConfigHelper.tsConfigPath)])
        .spread((hasJsConfig, hasTsConfig) => {
            if (hasJsConfig || hasTsConfig) {
                return Q.resolve(void 0);
            }

            return fileSystem.writeFile(JsConfigHelper.jsConfigPath,
                JSON.stringify(JsConfigHelper.defaultJsConfig, null, 4));
        });
    }
}
