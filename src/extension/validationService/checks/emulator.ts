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

const label = "Android Emulator";

async function test(): Promise<ValidationResultT> {
    if (!cexists.sync("emulator")) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    const command = "emulator -version";
    const data = await executeCommand(command);

    const text = normizeStr(data.stdout).split("\n")[0];
    const reg = /version (.*?)( |$)/gi;

    // something like '30.9.5.0' converts to '30.9.5', safe with nulls
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
    platform: ["win32"],
    description: toLocale(
        "EmulatorCheckDescription",
        "Required for working with Android emulators",
    ),
    category: CategoryE.Android,
    exec: test,
};

export default main;
