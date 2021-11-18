// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { executeCommand, normizeStr } from "../util";
import * as semver from "semver";
import { CategoryE, ValidationI, ValidationResultT } from "./types";

async function adbTest(): ValidationResultT {
    const command = "gradle -version";
    const data = await executeCommand(command);

    const text = normizeStr(data.stdout).split("\n")[2];
    const reg = /Gradle (.*?)( |$)/gi;
    const version = semver.coerce(reg.exec(text)?.[1]);

    if (!version) {
        return {
            status: "failure",
            comment: "Version check failed. Is gradle installed?",
        };
    }

    // #todo> Not sure which gradle versions are needed
    return {
        status: "success",
    };
}

const main: ValidationI = {
    label: "Gradle",
    description: "Requried for building your app",
    category: CategoryE.Android,
    exec: adbTest,
};

export default main;

main.exec().then(console.log);
