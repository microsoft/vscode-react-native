// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import {
    basicCheck,
    createNotFoundMessage,
    createVersionErrorMessage,
    executeCommand,
    parseVersion,
} from "../util";
import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const label = "VisualStudio";

async function test(): Promise<ValidationResultT> {
    let path = "";
    if (process.env["ProgramFiles(x86)"]) {
        path = `${process.env["ProgramFiles(x86)"]}/Microsoft Visual Studio/Installer/vswhere.exe`;
    } else {
        path = "C:\\Program Files (x86)\\Microsoft Visual Studio/Installer/vswhere.exe";
    }

    const components = [
        "Microsoft.Component.MSBuild",
        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
        "Microsoft.VisualStudio.ComponentGroup.UWP.Support",
        "Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core",
        "Microsoft.VisualStudio.Component.Windows10SDK.19041",
    ];
    const command = `${path} -property catalog_productDisplayVersion`;
    const result = await basicCheck({
        command: '"C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe"',
        versionRange: "16.5",
        getVersion: parseVersion.bind(null, command),
    });
    if (result.exists) {
        if (result.versionCompare === 1) {
            for (const comp of components) {
                const pathToComponent = await executeCommand(
                    `\"C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe\"  -requires ${comp}  -property productPath`,
                );
                if (!pathToComponent.stdout) {
                    return {
                        status: "failure",
                        comment: `Check if ${comp} installed.`,
                    };
                }
            }
            return {
                status: "success",
            };
        }
        if (result.versionCompare === -1) {
            return {
                status: "partial-success",
                comment:
                    "Detected version is older than 16.5. " +
                    "Please update Visual Studio in case of errors",
            };
        }
    }
    return {
        status: "failure",
        comment: createNotFoundMessage(label),
    };
}

const toLocale = nls.loadMessageBundle();

const main: IValidation = {
    label,
    platform: ["win32"],
    description: toLocale("VisualStudioCheckDescription", "Required for building RNW apps"),
    category: ValidationCategoryE.Windows,
    exec: test,
};

export default main;
