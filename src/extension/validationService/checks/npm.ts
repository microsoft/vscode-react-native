// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { executeCommand, normizeStr } from "../util";
import * as semver from "semver";
import { CategoryE, ValidationI, ValidationResultT } from "./types";

async function npmTest(): ValidationResultT {
    const command = "npm --version";
    const data = await executeCommand(command);

    const text = normizeStr(data.stdout).split("\n")[0];
    const version = semver.coerce(text);

    console.log("parsed npm version"); // #temp!>
    console.log(version); // #temp!>

    if (!version) {
        return {
            status: "failure",
            comment: "Version check failed. Is npm insalled and working correctly?",
        };
    }

    return { status: "success" };
}

const main: ValidationI = {
    label: "NPM",
    description: "Required for installing node packages",
    category: CategoryE.Common,
    exec: npmTest,
};

export default main;
