// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";
import * as nls from "vscode-nls";
import { createNotFoundMessage, runPowershellCommand } from "../util";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const label = 'LongPathSupport';

async function test(): Promise<ValidationResultT> {
    const command = '(Get-ItemProperty HKLM:/SYSTEM/CurrentControlSet/Control/FileSystem -Name LongPathsEnabled).LongPathsEnabled';
    if (parseInt(await runPowershellCommand(command)))
        return {
            status: "success",
        };
    return {
        status: "failure",
        comment: createNotFoundMessage(label),
    };
}

const toLocale = nls.loadMessageBundle();

const main: IValidation = {
    label,
    platform: ["win32"],
    description: toLocale("LongPathSupport", "Required for building RNW apps"),
    category: ValidationCategoryE.Windows,
    exec: test,
};

export default main;