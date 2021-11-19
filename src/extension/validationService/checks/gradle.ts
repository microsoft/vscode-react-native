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

const label = "Gradle";

async function gradleTest(): ValidationResultT {
    if (!(await cexists("gradle"))) {
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

const main: ValidationI = {
    label,
    description: toLocale("GradleTestDescription", "Requried for building your app"),
    category: CategoryE.Android,
    exec: gradleTest,
};

export default main;
