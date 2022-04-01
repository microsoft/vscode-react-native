// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { clean, gte } from "semver";
import * as nls from "vscode-nls";
import { executeCommand } from "../util";
import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const toLocale = nls.loadMessageBundle();

const label = "macOSVersion";

async function test(): Promise<ValidationResultT> {
    const command = "sw_vers";
    const data = await executeCommand(command);
    if (data.stdout) {
        const version = clean(data.stdout.split("\n")[1]) || "";
        if (gte(version, "10.13")) {
            return {
                status: "success",
            };
        }
    }
    return {
        status: "failure",
        comment: "Invalid macOS version",
    };
}

const main: IValidation = {
    label,
    platform: ["darwin"],
    description: toLocale("macOSversionTestDescription", "Required for building RN apps"),
    category: ValidationCategoryE.macOS,
    exec: test,
};

export default main;
