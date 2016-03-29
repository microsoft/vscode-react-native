// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";

import {ConfigurationReader} from "../common/configurationReader";
import {Packager} from "../common/packager";

export class WorkspaceConfiguration {
    /* We get the packager port configured by the user */
    public getPackagerPort(): number {
        return new ConfigurationReader().readInt(vscode.workspace.getConfiguration("react-native.packager").get("port", Packager.DEFAULT_PORT));
    }
}