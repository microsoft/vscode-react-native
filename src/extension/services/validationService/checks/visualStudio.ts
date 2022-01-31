// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import * as semver from "semver";
import { createNotFoundMessage, executeCommand, normizeStr } from "../util";
import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const toLocale = nls.loadMessageBundle();

const label = "Compilers, build tools, SDKs and Visual Studio";

async function test(): Promise<ValidationResultT> {
    let vswherePath = ``;
    if (process.env["ProgramFiles(x86)"]) {
        vswherePath = `"${process.env["ProgramFiles(x86)"]}\\Microsoft Visual Studio\\Installer\\vswhere.exe"`;
    } else {
        vswherePath = `"C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe"`;
    }
    const components = [
        "Microsoft.Component.MSBuild",
        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
        "Microsoft.VisualStudio.ComponentGroup.UWP.Support",
        "Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core",
        "Microsoft.VisualStudio.Component.Windows10SDK.19041",
    ];
    const command = `${vswherePath} -property catalog_productDisplayVersion`;
    const result = await executeCommand(command);
    if (result) {
        const versions = normizeStr(result.stdout).split("\n");
        let valid = false;
        for (const version of versions) {
            if (version) {
                if (semver.gtr(version, "16.5")) valid = true;
            }
        }
        if (valid) {
            for (const comp of components) {
                const pathToComponent = await executeCommand(
                    `${vswherePath}  -requires ${comp}  -property productPath`,
                );
                if (!pathToComponent.stdout) {
                    return {
                        status: "failure",
                        comment: `Please check if ${comp} is installed`,
                    };
                }
            }
            return {
                status: "success",
            };
        }
        return {
            status: "partial-success",
            comment:
                "Detected version is older than 16.5. " +
                "Please update Visual Studio in case of errors",
        };
    }
    return {
        status: "failure",
        comment: createNotFoundMessage(label),
    };
}

const main: IValidation = {
    label,
    platform: ["win32"],
    description: toLocale("VisualStudioCheckDescription", "Required for testing RNW apps"),
    category: ValidationCategoryE.Windows,
    exec: test,
};

export default main;
