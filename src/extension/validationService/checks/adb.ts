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

const label = "ADB";

async function adbTest(): ValidationResultT {
    if (!(await cexists("adb"))) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    const command = "adb --version";
    const data = await executeCommand(command);

    const text = normizeStr(data.stdout).split("\n")[1];
    const reg = /version (.*?)( |$)/gi;
    const version = semver.coerce(reg.exec(text)?.[1]);

    if (!version) {
        return {
            status: "failure",
            comment: createVersionErrorMessage(label),
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
    label,
    description: toLocale(
        "AdbCheckDescription",
        "Required for app installition. Minimal version is 12",
    ),
    category: CategoryE.Common,
    platform: "win32",
    exec: adbTest,
};

export default main;
