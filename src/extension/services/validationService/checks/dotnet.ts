// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import { createNotFoundMessage, createVersionErrorMessage, executeCommand } from "../util";
import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const label = ".NET Core 3.1";

async function test(): Promise<ValidationResultT> {
    const command = "dotnet --info";
    const data = await executeCommand(command);
    if (data.stdout) {
        if (data.stdout.includes("Microsoft.NETCore.App 3.1"))
            return {
                status: "success",
            };
        return {
            status: "failure",
            comment: createVersionErrorMessage(label),
        };
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
    description: toLocale("DotNetTestDescription", "Required for building RNW apps"),
    category: ValidationCategoryE.Windows,
    exec: test,
};

export default main;
