// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import { basicCheck, createVersionErrorMessage, parseVersion } from "../util";
import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const toLocale = nls.loadMessageBundle();

const label = "xcodeVersion";

async function test(): Promise<ValidationResultT> {
    const command = "xcodebuild -version";
    const result = await basicCheck({
        command,
        getVersion: parseVersion.bind(null, command, /\d+\.\d+\.\d+/gi),
        versionRange: "11.3.1",
    });
    if (result.exists) {
        if (result.versionCompare === -1) {
            return {
                status: "partial-success",
                comment:
                    "Detected version is older than 11.3.1 " +
                    "Please update Xcode in case of errors",
            };
        }
        if (result.versionCompare === undefined) {
            return {
                status: "failure",
                comment: createVersionErrorMessage(label),
            };
        }
    }
    return {
        status: "success",
    };
}

const main: IValidation = {
    label,
    platform: ["darwin"],
    description: toLocale("xcodeVersionTestDescription", "Required for building RN macOS apps"),
    category: ValidationCategoryE.macOS,
    exec: test,
};

export default main;
