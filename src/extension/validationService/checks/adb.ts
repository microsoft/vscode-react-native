// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { executeCommand, normizeStr } from "../util";
import * as semver from "semver";
import { CategoryE, ValidationI, ValidationResultT } from "./types";

async function adbTest(): ValidationResultT {
    const command = "adb --version";
    const data = await executeCommand(command);

    const text = normizeStr(data.stdout).split("\n")[1];
    const reg = /version (.*?)( |$)/gi;
    const version = semver.coerce(reg.exec(text)?.[1]);

    if (!version) {
        return {
            status: "failure",
            comment: "Version check failed. Is ADB installed?",
        };
    }

    const isOlder = semver.lt(version, "30.0.0");
    return isOlder
        ? {
              status: "partial-success",
              comment:
                  "Detected version is older than 30.0.0. " +
                  "Please update SDK tools in case of errors",
          }
        : {
              status: "success",
          };
}

const main: ValidationI = {
    label: "ADB",
    description: "Required for app installition. Minimal version is 12",
    category: CategoryE.Common,
    exec: adbTest,
};

export default main;
