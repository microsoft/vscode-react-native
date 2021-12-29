// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as semver from "semver";
import * as cexists from "command-exists";
import * as nls from "vscode-nls";
import {
    createNotFoundMessage,
    createVersionErrorMessage,
    executeCommand,
    normizeStr,
} from "../util";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "NPM";

async function test(): Promise<ValidationResultT> {
    if (!cexists.sync("npm")) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    const command = "npm --version";
    const data = await executeCommand(command);

    const text = normizeStr(data.stdout).split("\n")[0];
    const version = semver.coerce(text);

    if (!version) {
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
