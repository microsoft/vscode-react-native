// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    basicCheck,
    createNotFoundMessage,
    createVersionErrorMessage,
    parseVersion,
} from "../util";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";
import * as nls from "vscode-nls";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "NPM";

async function test(): Promise<ValidationResultT> {
    const result = await basicCheck({
        command: "npm",
        getVersion: parseVersion.bind(null, "npm --version"),
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

    return { status: "success" };
}

const main: IValidation = {
    label,
    description: toLocale("NpmCheckDescription", "Required for installing node packages"),
    category: ValidationCategoryE.Common,
    exec: test,
};

export default main;
