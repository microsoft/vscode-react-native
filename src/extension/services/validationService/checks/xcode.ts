// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import { clean, gte } from "semver";
import { executeCommand } from "../util";
import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const toLocale = nls.loadMessageBundle();

const label = "xcodeVersion";

async function test(): Promise<ValidationResultT> {
    const command = "xcodebuild -version";
    const data = await executeCommand(command);
    if (data.stdout) {
        const version = clean(data.stdout.split("\n")[1]) || "";
        if (gte(version, "11.3.1")) {
            return {
                status: "success",
            };
        }
    }
    return {
        status: "failure",
        comment: "Xcode version is lower then 11.3.1",
    };
}

const main: IValidation = {
    label,
    platform: ["darwin"],
    description: toLocale("xcodeVersionTestDescription", "Required for building RN apps"),
    category: ValidationCategoryE.macOS,
    exec: test,
};

export default main;
