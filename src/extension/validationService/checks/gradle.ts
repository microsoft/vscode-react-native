// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    createNotFoundMessage,
    createVersionErrorMessage,
    executeCommand,
    normizeStr,
} from "../util";
import * as semver from "semver";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";
import * as cexists from "command-exists";
import * as nls from "vscode-nls";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "Gradle";

async function test(): Promise<ValidationResultT> {
    if (!cexists.sync("gradle")) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    const command = "gradle -version";
    const data = await executeCommand(command);

    const text = normizeStr(data.stdout).split("\n")[2];
    const reg = /Gradle (.*?)( |$)/gi;
    const version = semver.coerce(reg.exec(text)?.[1]);

    if (!version) {
        return {
            status: "failure",
            comment: createVersionErrorMessage(label),
        };
    }

    // #todo> Not sure which gradle versions are required
    return {
        status: "success",
    };
}

const main: IValidation = {
    label,
    description: toLocale("GradleTestDescription", "Requried for building android apps"),
    category: ValidationCategoryE.Android,
    exec: test,
};

export default main;
