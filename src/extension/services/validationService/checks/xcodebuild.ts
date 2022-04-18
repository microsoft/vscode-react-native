// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import {
    basicCheck,
    createNotFoundMessage,
    createVersionErrorMessage,
    parseVersion,
} from "../util";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "XCodeBuild";

async function test(requiredVersion?: string): Promise<ValidationResultT> {
    const command = "xcodebuild";
    const result = await basicCheck({
        command,
        getVersion: parseVersion.bind(null, `${command} -version`, /\d+\.\d+\.\d+/gi),
        versionRange: requiredVersion,
    });
    if (!result.exists) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }
    if (requiredVersion) {
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
    return { status: "success" };
}

const xcodeBuild: IValidation = {
    label,
    platform: ["darwin"],
    description: toLocale("XCodeBuildTestDescription", "Required for building iOS apps"),
    category: ValidationCategoryE.iOS,
    exec: test,
};

const xcodeBuildVersionRNmacOS: IValidation = {
    label: `${label} version`,
    platform: ["darwin"],
    description: toLocale(
        "XCodeBuildVersionTestDescription",
        "Required for building and testing RN macOS apps",
    ),
    category: ValidationCategoryE.macOS,
    exec: test.bind(null, "11.3.1"),
};

export { xcodeBuild, xcodeBuildVersionRNmacOS };
