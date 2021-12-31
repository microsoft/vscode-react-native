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

const label = "Node.JS";

async function test(): Promise<ValidationResultT> {
    const result = await basicCheck({
        command: "node",
        versionRange: "12.0.0",
        getVersion: parseVersion.bind(null, "node --version"),
    });

    if (!result.exists) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    if (result.versionCompare === undefined) {
        return {
            status: "failure",
            comment: createVersionErrorMessage(label),
        };
    }

    if (result.versionCompare === -1) {
        return {
            status: "failure",
            comment:
                "Detected version is older than 12.0.0 " +
                `Minimal required version is 12.0.0. Please update your ${label} installation`,
        };
    }

    return { status: "success" };
}

const main: IValidation = {
    label,
    description: toLocale(
        "NodejsCheckDescription",
        "Required for code execution. Minimal version is 12",
    ),
    category: ValidationCategoryE.Common,
    exec: test,
};

export default main;
