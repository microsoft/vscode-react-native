// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";
import * as nls from "vscode-nls";
import { createNotFoundMessage, runPowershellCommand } from "../util";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const label = 'VisualStudio';

async function test(): Promise<ValidationResultT> {
    const path = `${process.env['ProgramFiles(x86)']}/Microsoft Visual Studio/Installer/vswhere.exe`;
    const components = "@('Microsoft.Component.MSBuild', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', 'Microsoft.VisualStudio.ComponentGroup.UWP.Support', 'Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core', 'Microsoft.VisualStudio.Component.Windows10SDK.19041');";
    const command = `Test-Path ${path} -version 16.5 -property productPath`
    if ((await runPowershellCommand(`Test-Path ${path}`)) == 'False')
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    else if ()

    // ToDo
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