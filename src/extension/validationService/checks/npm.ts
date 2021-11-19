// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    createNotFoundMessage,
    createVersionErrorMessage,
    executeCommand,
    normizeStr,
    toLocale,
} from "../util";
import * as semver from "semver";
import { CategoryE, ValidationI, ValidationResultT } from "./types";
import * as cexists from "command-exists";

const label = "NPM";

async function npmTest(): ValidationResultT {
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

const main: ValidationI = {
    label,
    description: toLocale("NpmCheckDescription", "Required for installing node packages"),
    category: CategoryE.Common,
    exec: npmTest,
};

export default main;
