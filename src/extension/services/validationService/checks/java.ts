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

const label = "Java";

async function test(): Promise<ValidationResultT> {
    // for future changes: keep in mind that java version format has changed since Java8
    const result = await basicCheck({
        command: "java",
        getVersion: parseVersion.bind(null, "java -version", /version "(.*?)"( |$|\n)/gi, "stderr"),
        versionRange: "1.8.0",
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
            status: "partial-success",
            comment: `Detected version is older than 1.8.0. Please install ${label} 8 in case of errors`,
        };
    }

    return { status: "success" };
}

const main: IValidation = {
    label,
    description: toLocale("JavaCheckDescription", "Required as part of Anrdoid SDK"),
    category: ValidationCategoryE.Android,
    exec: test,
};

export default main;
