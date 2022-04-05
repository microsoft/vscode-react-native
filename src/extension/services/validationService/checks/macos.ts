// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import {
    basicCheck,
    createNotFoundMessage,
    createVersionErrorMessage,
    parseVersion,
} from "../util"; // executeCommand
import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const toLocale = nls.loadMessageBundle();

const label = "macOSVersion";

async function test(): Promise<ValidationResultT> {
    const result = await basicCheck({
        command: "sw_vers",
        getVersion: parseVersion.bind(null, "sw_vers", /\d+\.\d+\.\d+/gi),
        versionRange: "10.13",
    });
    if (result.exists) {
        if (result.versionCompare === -1) {
            return {
                status: "partial-success",
                comment:
                    "Detected version is older than 10.13 " +
                    "Please update SDK tools in case of errors",
            };
        }
        if (result.versionCompare === undefined) {
            return {
                status: "failure",
                comment: createVersionErrorMessage(label),
            };
        }
    } else {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    return {
        status: "success",
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
