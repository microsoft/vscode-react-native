// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import { executeCommand } from "../util";
import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const toLocale = nls.loadMessageBundle();

const label = "DeveloperMode";

async function test(): Promise<ValidationResultT> {
    const command =
        "reg query HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock /v AllowDevelopmentWithoutDevLicense";
    const data = await executeCommand(command);
    if (data.stdout) {
        if (data.stdout.includes(" 0x1"))
            return {
                status: "success",
            };
    }

    return {
        status: "failure",
        comment: "Developer mode is disabled",
    };
}

const main: IValidation = {
    label,
    platform: ["win32"],
    description: toLocale(
        "DeveloperModeTestDescription",
        "Required for launching and debugging RNW apps",
    ),
    category: ValidationCategoryE.Windows,
    exec: test,
};

export default main;
